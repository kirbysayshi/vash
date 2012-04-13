
function VAST(root){
	
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
}

