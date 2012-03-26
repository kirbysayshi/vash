function VCompiler(){
	this.lex = new VLexer();
	this.parser = new VParser();
	this.tokens = [];
}

var VCP = VCompiler.prototype;

VCP.tokenize = function(str){
	var tok;

	while( tok = this.lex.advance() ){
		this.tokens.push(tok);
	}

	return this.tokens;
}

VCP.firstPass = function(){
	// do typical pass, but don't condense/consume tokens, just mark tokens as MKP, BLK, EXP

	// remove @* comments
	// find matching {} blocks
	// condense matching () ?
	// mark function ... } blocks
}

VCP.secondPass = function(){
	// condense tokens of matching adjacent blocks, as long as they are on the same source line
}

VCP.make = function(){
	// compile condensed tokens into a function of out.push() statements and code 
}
