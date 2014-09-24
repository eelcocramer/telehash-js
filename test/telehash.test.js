var expect = require('chai').expect;
var telehash = require('../telehash.js');
var lob = require('lob-enc');

describe('telehash', function(){
  var idA = {"keys":{"1a":"akndnx5kbansip6xphxymwckpqkjj26fcm"},"secrets":{"1a":"ksxslm5mmtymnbph7nvxergb7oy3r35u"},"hashname":"5uegloufcyvnf34jausszmsabbfbcrg6fyxpcqzhddqxeefuapvq"};
  var idB = {"keys":{"1a":"apkoh54rkobkeela6d62hblhqd7grqd5dm"},"secrets":{"1a":"ljfm3ov42x2fl6gsg6bxiqgtstnxls7r"},"hashname":"fvifxlr3bsaan2jajo5qqn4au5ldy2ypiweazmuwjtgtg43tirkq"};

  it('should export an object', function(){
    expect(telehash).to.be.a('object');
  });

  it('should support adding extensions', function(){
    expect(telehash.add({name:'test'})).to.be.true;
  });

  it('should support logging', function(done){
    telehash.log({debug:function(msg){
      expect(msg).to.exist;
      // disable
      telehash.log({debug:console.log});
      done();
    }});
    // just run something that logs
    telehash.generate(function(err, secrets){});
  });

  it('should generate', function(done){
    telehash.generate(function(err, id){
      expect(err).to.not.exist;
      expect(id).to.be.an('object');
      expect(id.hashname).to.be.a('string');
      expect(id.hashname.length).to.be.equal(52);
      console.log('idA',JSON.stringify(id));
      done();
    });
  });

  it('should create a mesh', function(done){
    telehash.mesh({id:idA,extensions:{}},function(err, mesh){
      expect(err).to.not.exist;
      expect(mesh).to.be.an('object');
      expect(mesh.hashname).to.be.equal(idA.hashname);
      expect(mesh.router).to.be.a('function');
      expect(mesh.link).to.be.a('function');
      expect(mesh.discover).to.be.a('function');
      done();
    });
  });

  it('should create a link', function(done){
    telehash.mesh({id:idA,extensions:{}},function(err, mesh){
      var link = mesh.link({keys:idB.keys});
      expect(link).to.be.an('object');
      expect(link.hashname).to.be.equal(idB.hashname);
      expect(link.router).to.be.a('function');
      done();
    });
  });

  it('should return an exchange', function(done){
    telehash.mesh({id:idA,extensions:{}},function(err, mesh){
      var link = mesh.link({keys:idB.keys});
      expect(link.x).to.be.an('object');
      expect(link.x.sending).to.be.a('function');
      done();
    });
  });

  it('should create a transport', function(done){
    var ext = {name:'test',mesh:function(mesh){
      expect(mesh).to.be.an('object');
      done();
    }};
    telehash.mesh({id:idA,extensions:{}},function(err, mesh){
      mesh.extend(ext);
    });
  });

  it('should enable discovery', function(done){
    var ext = {name:'test',mesh:function(mesh,cb){
      cb(undefined,{discover:function(opts){
        expect(opts).to.be.an('object');
        done();
      }});
    }};
    telehash.mesh({id:idA,extensions:{}},function(err, mesh){
      mesh.extend(ext, function(){
        mesh.discover({discover:function(){}});
      });
    });
  });

  it('should discover', function(done){
    telehash.mesh({id:idB,extensions:{}},function(err, mesh){
      mesh.discover({discover:function(from){
        expect(from).to.be.an('object');
        expect(from.csid).to.be.equal('1a');
        expect(from.hashname).to.be.equal(idA.hashname);
        expect(from.paths[0].type).to.be.equal('test');
        expect(mesh.link(from)).to.exist;
        done();
      }},function(err){
        expect(err).to.not.exist;
        var pipe = new telehash.Pipe('test');
        pipe.path = {type:'test'};
        pipe.onSend = function(){};
        mesh.receive(lob.decode(new Buffer('00011a02228b5eebab016d725049a4b5f71344e8b60a3037156420ebab916f128333b5d72abf804cc37b9978b12278c8aac65905301deee657c9d8b00f2a5e372b1c222213a94c82','hex')),pipe);
      });
    });
  });

  it('should create a pipe to a transport', function(done){
    var ptest = {type:'test',test:true};
    var ext = {name:'test',mesh:function(mesh,cbExt){
      cbExt(undefined,{pipe:function(link,path,cbPipe){
        expect(link.hashname).to.be.equal(idB.hashname);
        expect(path).to.be.equal(ptest);
        cbPipe(new telehash.Pipe('test'));
      }});
    }};
    telehash.mesh({id:idA,extensions:{}},function(err, mesh){
      mesh.extend(ext,function(err){
        expect(err).to.not.exist;
        var link = mesh.link({keys:idB.keys});
        link.addPath(ptest,function(pipe){
          expect(pipe.type).to.be.equal('test');
          done();
        });
      });
    });
  });

  it('should generate a keepalive', function(done){
    var ext = {name:'test',mesh:function(mesh,cbExt){
      cbExt(undefined,{pipe:function(hn,path,cbPipe){
        var pipe = new telehash.Pipe('test');
        pipe.onSend = function(packet){
          expect(Buffer.isBuffer(packet)).to.be.true;
          expect(packet.length).to.be.equal(72);
          console.log('handshakeAB',packet.toString('hex'));
          done();
        };
        cbPipe(pipe);
      }});
    }};
    telehash.mesh({id:idA,extensions:{}},function(err, mesh){
      mesh.extend(ext,function(){
        var link = mesh.link({keys:idB.keys});
        link.addPath({type:'test'});
      });
    });
  });

  it('should create a full link', function(done){
    telehash.log({debug:console.log});
    telehash.mesh({id:idA,extensions:{}},function(err, meshA){
      expect(err).to.not.exist;
      telehash.mesh({id:idB,extensions:{}},function(err, meshB){
        expect(err).to.not.exist;

        meshA.mesh(meshB);
        var link = meshA.link(meshB.hashname);
        expect(link).to.exist;
        link.status(function(err){
          expect(err).to.not.exist;
          done();
        });
      });
    });
  });

});
