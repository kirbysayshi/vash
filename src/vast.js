/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

var vQuery = function(node){
	return new vQuery.fn.init(node);
}

vQuery.prototype.init = function(astNode){

	// handle falsy
	if(!astNode) return this;

	// handle mode string
	if(typeof astNode === 'string'){
		this.mode = astNode;
		return this;
	}

	// handle plain token?
	if(!vQuery.isArray(astNode) && astNode.vquery !== this.vquery){
		astNode = [astNode];
	} else {

		// protect against ridiculous bugs
		if( astNode.length >= vQuery.maxSize ){
			throw { name: 'vQuery Error', message: 'Maximum number of elements exceeded' };
		}
	}

	if( astNode.vquery === this.vquery ){
		return astNode;
	}

	return vQuery.makeArray(astNode, this);
}

vQuery.fn = vQuery.prototype.init.prototype = vQuery.prototype;

vQuery.fn.vquery = 'yep';
vQuery.fn.constructor = vQuery;
vQuery.fn.length = 0;
vQuery.fn.parent = null;
vQuery.fn.mode = null;
vQuery.fn.tagName = null;

vQuery.fn.beget = function(mode, tagName){
	var child = vQuery();
	child.mode = mode;
	child.parent = this;
	this.push( child );

	if(tagName) { child.tagName = tagName; }

	return child;
}

vQuery.fn.every = function(fun /*, thisp */) {  
	"use strict";  

	if (this == null)
		throw new TypeError();

	var t = Object(this);
	var len = t.length >>> 0;
	if (typeof fun != "function")
		throw new TypeError();

	var thisp = arguments[1];
	for (var i = 0; i < len; i++){
		if (i in t && !fun.call(thisp, t[i], i, t))
			return false;
	}

	return true;
};  

vQuery.fn.each = function(cb){
	vQuery.each(this, cb, this);
	return this;
}

vQuery.fn.closest = function(mode, tagName){
	var p = this;

	if(!tagName){
		while( p && (p.mode !== mode || p == this) && p.parent && (p = p.parent) );
	} else {

		while(p){

			if( p.tagName !== tagName && p.parent ){
				p = p.parent;
			} else {
				break;
			}
		}

		//while( p && (p.mode !== mode || p == this) && p.tagName !== tagName && p.parent && (p = p.parent) );
	}

	return p;
}

vQuery.fn.pushFlatten = function(node){
	var n = node, i, children;

	while( n.length === 1 && n[0].vquery ){
		n = n[0];
	}

	if(n.mode !== VParser.modes.PRG){
		this.push(n);	
	} else {

		for(i = 0; i < n.length; i++){
			this.push( n[i] )
		}
	}

	return this;
}

vQuery.fn.push = function(nodes){

	if(vQuery.isArray(nodes)){
		if(nodes.vquery){
			vQuery.each(nodes, function(node){ node.parent = this; }, this);	
		}
		
		Array.prototype.push.apply(this, nodes);
	} else {
		if(nodes.vquery){
			nodes.parent = this;	
		}
		
		Array.prototype.push.call(this, nodes);
	}

	return this.length;
}

vQuery.fn.root = function(){
	var p = this;

	while(p && p.parent && (p = p.parent));

	return p;
}

vQuery.fn.toTreeString = function(){
	var  buffer = []
		,indent = 1;

	function visitNode(node){
		var  children
			,child

		buffer.push( Array(indent).join(' |') + ' +' + node.mode + ' ' + ( node.tagName || '' ) );

		indent += 1;
		children = node.slice();
		while( (child = children.shift()) ){

			if(child.vquery === vQuery.fn.vquery){
				// recurse
				visitNode(child);
			} else {
				buffer.push( Array(indent).join(' |') + ' ' 
					+ (child
						?  child.toString()
						: '[empty]') 
				);
			}

		}

		indent -= 1;
	}

	visitNode(this);

	return buffer.join('\n');
}

vQuery.maxSize = 500000;

// via jQuery
vQuery.makeArray = function( array, results ) {
	array = Array.prototype.slice.call( array, 0 );

	if ( results ) {
		results.push.apply( results, array );
		results.mode = array.mode;
		results.parent = array.parent;
		results.tagName = array.tagName;
		return results;
	}
	
	return array;
};

vQuery.isArray = function(obj){
	return Object.prototype.toString.call(obj) == '[object Array]'
}

vQuery.each = function(nodes, cb, scope){
	var i, node;

	for(i = 0; i < nodes.length; i++){
		node = nodes[i];
		cb.call( (scope || node), node, i );
	}
}

vQuery.copyObj = function(obj){
	var nObj = {};

	for(var i in obj){
		if(Object.prototype.hasOwnProperty.call(obj, i)){
			nObj[i] = obj[i];
		}
	}

	return nObj;
}

vQuery.takeMethodsFromArray = function(){
	var methods = [
		'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift',
		'concat', 'join', 'slice', 'indexOf', 'lastIndexOf',
		'filter', 'forEach', 'every', 'map', 'some', 'reduce', 'reduceRight'
	]

		,arr = []
		,m;

	for (var i = 0; i < methods.length; i++){
		m = methods[i];
		if( typeof arr[m] === 'function' ){
			if( !vQuery.fn[m] ){
				(function(methodName){ 
					vQuery.fn[methodName] = function(){
						return arr[methodName].apply(this, vQuery.makeArray(arguments));
					}
				})(m);
			}
		} else {
			throw new Error('Vash requires ES5 array iteration methods, missing: ' + m);
		}
	}

}

vQuery.takeMethodsFromArray(); // run on page load
