var Duplex = require('stream').Duplex;
var util = require("util");
var lob = require('lob-enc');

module.exports = ChannelStream

/** ChannelStream impliments a Duplex stream API over Telehash channels.
 * for Duplex stream usage, consult core node docs. for an idea of how you might
 * expand upon streams within the Telehash ecosystem, see thtp
 * @class ChannelStream
 * @constructor
 * @param {Channel} channel - a Telehash channel (generated by e3x)
 * @param {stringa} encoding - 'binary' or 'json'
 * @return {Stream}
 */
function ChannelStream(chan, encoding){
  if(!encoding) encoding = 'binary';
  if(typeof chan != 'object' || !chan.isChannel)
  {
    mesh.log.warn('invalid channel passed to streamize');
    return false;
  }

  var allowHalfOpen = (chan.type === "thtp") ? true : false;

  Duplex.call(this,{allowHalfOpen: allowHalfOpen, objectMode:true})
  this.on('finish',function(){
    console.log("finish")
    chan.send({json:{end:true}});
  });

  this.on('error',function(err){
    if(err == chan.err) return; // ignore our own generated errors
    console.log('streamized error',err);
    chan.send({json:{err:err.toString()}});
  });
  var stream = this

  this.on('pipe', function(from){
    from.on('end',function(){
      console.log("srteam from pipe end")
      stream.end()
    })
  })


  chan.receiving = chan_to_stream(this);

  this._chan = chan;
  this._encoding = encoding;

  return this;
}

util.inherits(ChannelStream, Duplex)



ChannelStream.prototype._read = function(size){
  if(this._getNextPacket) this._getNextPacket();

  this._getNextPacket = false;
};

ChannelStream.prototype._write = function(data,enc,cbWrite)
{
  if(this._chan.state == 'gone') return cbWrite('closed');
  // switch to our default encoding syntax
  // dynamically detect object streams and change encoding
  if(!Buffer.isBuffer(data) && typeof data != 'string')
  {
    data = JSON.stringify(data);
    this._encoding = 'json';
  }
  // fragment it
  while(data.length)
  {
    var frag = data.slice(0,1000);
    data = data.slice(1000);
    var packet = {json:{},body:frag};
    // last packet gets continuation callback
    if(!data.length)
    {
      if(enc != 'binary') packet.json.enc = this._encoding;
      packet.callback = cbWrite;
    }else{
      packet.json.frag = true;
    }
    this._chan.send(packet);
  }
}

function chan_to_stream (stream){
  var data = new Buffer(0);

  return function receiving(err, packet, getNextPacket) {
    // was a wait writing, let it through

    if(err)
      stream.emit('error',err);

    if(packet.body.length || data.length)
    {
      data = Buffer.concat([data,packet.body]);
      if(!packet.json.frag)
      {
        var body = data;
        data = new Buffer(0);
        if(packet.json.enc == 'json') try{
          body = JSON.parse(body)
        }catch(E){
          console.log('stream json frag parse error',E,body.toString());
          err = E;
        }
        if(packet.json.enc == 'lob')
        {
          var packet = lob.decode(body);
          if(!packet)
          {
            mesh.log.warn('stream lob frag decode error',body.toString('hex'));
            err = 'lob decode failed';
          }else{
            body = packet;
          }
        }


        // stream consumer is not ready for another packet yet, so hold on
        // before getting more to send to readable...
        if(!err && !stream.push(body))
          stream._getNextPacket = getNextPacket;
      }
    }

    //the packet has been read by stream consumer, so get the next one
    if(!stream._getNextPacket)
      getNextPacket();

    //close the stream if this is the last packet
    if(packet.json.end)
      stream.push(null);


  };
}