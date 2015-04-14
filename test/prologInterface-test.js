"use strict";
var assert = require('assert');
var $S = require('suspend'), $R = $S.resume, $T = function(gen) { return function(done) { $S.run(gen, done); } };

var PrologInterface = require('../js/prologInterface.js');

describe('PrologInterface', function(){
    describe('.request(req)', function(){
	it('should return an event emitter', function(done){
	    var prolog = new PrologInterface();
	    var emitter = prolog.request("heartbeat");
	    emitter.on('done', done);
	});
	it('should emit an error on unknown events', function(done){
	    var prolog = new PrologInterface();
	    var emitter = prolog.request("foo(bar)");
	    emitter.on('error', function(err) {
		done();
	    });
	});
	it('should emit a success event with a result on success', function(done){
	    var prolog = new PrologInterface();
	    var emitter = prolog.request("heartbeat");
	    emitter.on('success', function(status) {
		assert.equal(status, "alive");
		done();
	    });
	});
	it('should emit done even in case of an error', function(done){
	    var prolog = new PrologInterface();
	    var emitter = prolog.request("foo(bar)");
	    emitter.on('error', function(err) {});
	    emitter.on('done', done);
	});
	it('should emit events only for the current request', $T(function*(){
	    var prolog = new PrologInterface();
	    var emitter1 = prolog.request("heartbeat");
	    var count = 0;
	    emitter1.on('success', function() {
		count += 1;
	    });
	    yield emitter1.on('done', $R());
	    var emitter2 = prolog.request("heartbeat");
	    yield emitter2.on('done', $R());
	    assert.equal(count, 1);
	}));
	it('should queue requests so that they do not overlap', $T(function*(){
	    var prolog = new PrologInterface();
	    var emitter1 = prolog.request("heartbeat");
	    var count = 0;
	    emitter1.on('success', function() {
		count += 1;
	    });
	    // not waiting
	    var emitter2 = prolog.request("heartbeat");
	    yield emitter2.on('done', $R());
	    assert.equal(count, 1);
	}));
    });
    it('should support creation of new chunks', $T(function*(){
	var prolog = new PrologInterface();
	var em = prolog.request("create([add_v((foo(bar) :- true), 1)])");
	var r = $R();
	var id = (yield em.on('success', $S.resumeRaw()))[0];
	var split = id.split(',');
	assert.equal(split[0], split[1]);
    }));
    function* createChunk(prolog, ops) {
	var em = prolog.request("create([" + ops.join(",") + "])");
	var r = $R();
	return (yield em.on('success', $S.resumeRaw()))[0];
    }
    it('should support queries on chunks', $T(function*(){
	var prolog = new PrologInterface();
	var id = yield* createChunk(prolog, ["add_v((foo(bar) :- true), 1)"]);
	var em = prolog.request("on((" + id + "), logicQuery(X, foo(X), 1))");
	var res = (yield em.on('downstream', $S.resumeRaw()))[0];
	assert.equal(res, "res(bar,1)");
    }));
});