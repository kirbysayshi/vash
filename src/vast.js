/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

var vQuery = function(node){
	return new vQuery.prototype.init(node);
}

vQuery.prototype.vquery = 'yep';
vQuery.prototype.constructor = vQuery;
vQuery.prototype.length = 0;
vQuery.prototype.parent = null;
vQuery.prototype.mode = null;
vQuery.prototype.tagName = null;

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

vQuery.prototype.init.prototype = vQuery.prototype;

vQuery.prototype.beget = function(mode, tagName){
	var child = vQuery();
	child.mode = mode;
	child.parent = this;
	this.push( child );

	if(tagName) child.tagName = tagName;

	return child;
}

vQuery.prototype.every = function(fun /*, thisp */) {  
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

vQuery.prototype.each = function(cb){
	vQuery.each(this, cb, this);
	return this;
}

vQuery.prototype.closest = function(mode, tagName){
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

	return vQuery(p);
}

vQuery.prototype.pushFlatten = function(node){
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

vQuery.prototype.push = function(nodes){

	if(vQuery.isArray(nodes)){
		if(nodes.vquery){
			vQuery.each(nodes, function(node){ node.parent = this; }, this);	
		}
		
		Array.prototype.push.apply(this, nodes)
	} else {
		if(nodes.vquery){
			nodes.parent = this;	
		}
		
		Array.prototype.push.call(this, nodes)
	}

	return this.length;
}

// [mode=BLK], [mode=EXP], [type=PAREN_OPEN]
vQuery.prototype.find = function(selector, results){

	var i, j, child;

	results = results || [];

	if( !vQuery.isArray(selector) ){
		selector = vQuery.parseSelector(selector);
	}

	for(i = 0; i < this.length; i++){
		child = this[i];

		if(child.vquery){
			child.find(selector, results);
		} 

		for(j = 0; j < selector.length; j++){

			if( selector[j](child) === true ){
				results.push(child);
			}
		}
	}

	return results;
}

vQuery.prototype.root = function(){
	var p = this;

	while(p && p.parent && (p = p.parent));

	return p;
}

vQuery.prototype.toTreeString = function(){
	var  buffer = []
		,indent = 1;

	function visitNode(node){
		var  children
			,child

		buffer.push( Array(indent).join(' |') + ' +' + node.mode + ' ' + ( node.tagName || '' ) );

		indent += 1;
		children = node.slice();
		while( (child = children.shift()) ){

			if(child.vquery === vQuery.prototype.vquery){
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

vQuery.parseSelector = function(selector){

	var  groups = selector.split(',')
		,group
		,eqIndex
		,i
		,child
		,tests = [];

	for(i = 0; i < groups.length; i++){

		// trim
		group = groups[i].replace(/^\s+/, '').replace(/\s+$/, '');

		// HANDLE: 'attribute'
		if(group[0] === '[' && group[group.length-1] === ']'){

			// remove []
			group = group.substring(1, group.length - 1);

			// HANDLE: attribute !=
			if( (eqIndex = group.indexOf('!=')) ){

				tests.push( (function(property, value){ 
					return function(node){
						return node[ property ] !== value
					}
				})( group.substring(0, eqIndex), group.substring(eqIndex + 2)) )

			// HANDLE: attribute =
			} else if( (eqIndex = group.indexOf('=')) ){

				tests.push( (function(property, value){ 
					return function(node){
						return node[ property ] === value
					}
				})( group.substring(0, eqIndex), group.substring(eqIndex + 2)) )
			}
		}
	}

	return tests;
}

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
		if( typeof arr[m] === 'function' && !vQuery.prototype[m] ){
			(function(methodName){ 
				vQuery.prototype[methodName] = function(){
					return arr[methodName].apply(this, vQuery.makeArray(arguments));
				}
			})(m);
		}
	}

}

vQuery.takeMethodsFromArray(); // run on page load

var VAST = {

	makeNode: function(mode, parent){
		var n = [];
		n.mode = mode;
		n.isASTNode = true;
		n.parent = parent || null;

		return n;
	}

	,makeMarkupNode: function(tagName, parent){
		var n = VAST.makeNode(VParser.modes.MKP, parent);
		n.tagName = tagName;

		return n;
	}

	,findNodeOfMode: function(node, mode){
		var i, child;

		for(i = 0; i < node.length; i++){
			child = node[i];

			if(child.isASTNode && child.mode === mode){
				return child;
			}
		}
	}

	,findAncestor: function(node, mode){
		var p = node.parent;

		while(p && p.mode !== mode && p.parent && (p = p.parent));

		return p;
	}

	,root: function(node){
		var p = node.parent;

		while(p && p.parent && (p = p.parent));

		return p;
	}

}

/*function VAST(root){
	
	this.current = this.openNew( VParser.modes.PRG );
	this.rootNode = this.current;	
}

VAST.prototype.root = function(){
	this.current = this.rootNode;
	return this.rootNode;
}

VAST.prototype.useToken = function(tok){

	var method = this.current.closed() || this.current.children.length > 0
		? this.useAsStopper
		: this.useAsStarter;

	tok = vash.isArray(tok)
		? tok
		: [tok];

	for(var i = 0; i < tok.length; i++){
		method.call(this, tok[i]);
	}
}

VAST.prototype.useAsStarter = function(tok){
	this.current.starter.push(tok);
}

VAST.prototype.useAsStopper = function(tok){
	this.current.stopper.push(tok);
}

VAST.prototype.openNew = function(type, parent){
	var n = new VASTNode();
	n.type = type;
	n.parent = parent || this.current;

	return n;
}

VAST.prototype.openNewAsChild = function(type, tok, forceDuplicate){

	var n;

	if(this.current.closed()){
		this.openNewAsSibling(type, tok);
		return
	}

	if( forceDuplicate !== true
		&&this.current.children.length === 0 
		&& this.current.starter.length === 0
		&& this.current.stopper.length === 0
		&& this.current.type !== VParser.modes.PRG
	) {
		n = this.current;
		this.current.type = type;
	} else {
		n = this.openNew(type, this.current);	
		this.current.children.push(n);
		this.current = n;
	}

	tok && n.starter.push(tok);
}

VAST.prototype.openNewAsSibling = function(type, tok){
	var n = this.openNew(type, this.current.parent);
	tok && n.starter.push(tok);

	n.parent.children.push(n);
	this.current = n;
}

VAST.prototype.closeCurrent = function(){
	this.current = this.current.parent;
}

VAST.prototype.searchParentsFor = function( property, value ){
	var p = this.current;

	while(p && p.parent && p[property] !== value && (p = p.parent));

	if(p[property] !== value) return null;
	else return p;
}

VAST.prototype.searchParentsByTypeFor = function( type, property, value ){
	var p = this.current;

	while(p && p[property] !== value && p.type !== type && (p = p.parent));

	if(p[property] !== value) return null;
	else return p;
}

VAST.prototype.flatten = function(){

	var all = [];

	function visitNode(node){
		var child, children;

		node.starter.forEach(function(n){ n.mode = node.type; });
		node.stopper.forEach(function(n){ n.mode = node.type; });

		all.push.apply( all, node.starter );

		children = node.children.slice();
		while( (child = children.shift()) ){
			visitNode(child)
		}

		all.push.apply( all, node.stopper );
	}

	visitNode(this.current);

	return all;
}

VAST.prototype.toTreeString = function(){
	var  buffer = []
		
		,indent = 1;

	function joinTokens(toks, indent){
		return toks.map(function(n){ 
			return Array(indent).join(' |') + ' ' + (n
				?  n.toString()
				: '[empty]');
		}) 
	}

	function visitNode(node){
		var  children
			,child

		buffer.push( Array(indent-1).join(' |') + ' +' + node.type );
		//if(node.starter.length === 0) node.starter.push('');
		buffer.push.apply( buffer, joinTokens(node.starter, indent))

		indent += 2;
		children = node.children.slice();
		while( (child = children.shift()) ){
			visitNode(child); 
		}
		indent -= 2;

		//if(node.stopper.length === 1) node.stopper.unshift('');
		buffer.push.apply( buffer, joinTokens(node.stopper, indent) )
	}

	visitNode(this.current)

	return buffer.join('\n');
}


function VASTNode(){
	this.type = ''; //
	this.tagName = null;
	this.parent = null; 
	this.starter = [];
	this.children = [];
	this.stopper = [];
}

VASTNode.prototype.closed = function(){
	return this.stopper.length > 0;
}

VASTNode.prototype.asTag = function(tagName){
	this.tagName = tagName;
}*/

