	

(function(root){
	
var TKS = {
    AT:     		/@/,
    PARENSTART:    	/\(/,
    PARENEND:      	/\)/,
    //COLON:      	/:/,
    BRACESTART:    	/\{/,
    BRACEEND:      	/\}/, 
    LT:         	/</,
    //GT:         	/>/,
    HARDPARENSTART:	/\[/,
    HARDPARENEND:  	/\]/,
	PERIOD: 		/\./,
	LBBRACEEND: 	/[\n\r]{1,}[^\S\r\n]*\}$/, // newline + optional whitespace + BRACEEND
	TAGOC: 			/\/|[a-zA-Z]/, // tag open or close, minus <
	EMAILCHARS: 	/[a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^\_\`\{\|\}\~]/,
	IDENTIFIER: /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*/, // this could be simplifed to not support unicode
	RESERVED: /^case|catch|do|else|finally|for|function|goto|if|instanceof|return|switch|try|typeof|while|with/,
	//RESERVED: /^abstract|as|boolean|break|byte|case|catch|char|class|continue|const|debugger|default|delete|do|double|else|enum|export|extends|false|final|finally|float|for|function|goto|if|implements|import|in|instanceof|int|interface|is|long|namespace|native|new|null|package|private|protected|public|return|short|static|super|switch|synchronized|this|throw|throws|transient|true|try|typeof|use|var|void|volatile|while|with/,
	
	// these are used for template generation, not parsing
    QUOTE:      	/[\"']/gi,
	LINEBREAK:  	/[\n\r]/gi
};


// markup, js block, implicit js expression
var modes = { MKP: "MARKUP", BLK: "BLOCK", EXP: "EXPRESSION" };

function parse(str){

	// current mode
	var mode = modes.MKP, modeStack = [modes.MKP];

	var buffer = '', buffers = [];

	// characters. i = cursor, j = future cursor, if needed
	var prev, curr, next, i, j;

	var identifier = '', identifierMatch = null;

	// this is a hack, currently, to allow for closing of { } blocks simply
	var codeNestLevel = 0;

	// adds characters, including the current, to the buffer until 
	// a matched character is found. For example: curr == (, so it
	// would consume until a matching ) is found, being sure they 
	// actually match in case of nested characters.
	// This is defined here to allow it to access parser state.
	function consumeUntilMatched(sRe, eRe){
		var groupLevel = 1;
		while( groupLevel > 0 ){
			j += 1;
			curr = str[j];
			if(j < str.length - 1) next = str[j+1];
		
			if(sRe.test(curr) === true) groupLevel += 1;
			if(eRe.test(curr) === true) groupLevel -= 1;
		
			if(j >= str.length) throw new Error('Syntax Error, unmatched ' + sRe);
		}
	
		// add ( something something (something something) ) to buffer
		buffer += str.substring(i, j+1);
	
		i = j; // advance i to current char
		curr = str[i]; // curr will be equal to )
		if(i < str.length - 1) next = str[i+1];
	}


	// the main parser loop/entry point
	for(i = 0; i < str.length; i++){
		if(i > 0) prev = str[i-1];
		curr = str[i];
		if(i < str.length - 1) next = str[i+1];
	
		if(mode === modes.MKP){
			// current character is @
			if(TKS.AT.test(curr) === true){
				if(i > 0 && TKS.EMAILCHARS.test(prev) === true && TKS.EMAILCHARS.test(next)){
					// this test is invalid if the first character of the str
					// before and after @ are valid e-mail address chars
					// assume it's an e-mail address and continue
					buffer += curr;
				} else {
					if(TKS.AT.test(next) === true){
						// escaped @. continue, but ignore one @
						buffer += curr;
						i += 1; // skip next @
					} else if(TKS.BRACESTART.test(next) === true){
						// found {, enter block mode
						buffers.push( { type: modes.MKP, value: buffer } );
						buffer = ''; // blank out markup buffer;
						//codeNestLevel += 1;
						mode = modes.BLK;
						continue;
					} else if(TKS.BRACEEND.test(next) === true){
						// found }, assume explicit closing of block
						buffers.push( { type: modes.MKP, value: buffer } );
						buffer = ''; // blank out markup buffer;
						mode = modes.BLK;
						continue;
					} else if(TKS.PARENSTART.test(next) === true){
					
						// end of markup mode, switch to EXP
						buffers.push( { type: modes.MKP, value: buffer } );
						buffer = ''; // blank out markup buffer;
					
						mode = modes.EXP;
						continue;
						
					} else {
						// test for identifier
						identifier = str.substring(i+1); // everything after @
						identifierMatch = identifier.match( TKS.IDENTIFIER );
					
						if(identifierMatch === null){
							// stay in content mode?
							buffer += curr;
						} else {
							// found either a reserved word or a valid JS identifier
						
							if(TKS.RESERVED.test(identifierMatch[0]) === true){
								// found a reserved word, like while
								// switch to JS Block mode
								buffers.push( { type: modes.MKP, value: buffer } );
								buffer = identifierMatch[0];
								mode = modes.BLK;
								//codeNestLevel += 1;
								i += buffer.length; // skip identifier and continue in block mode
								continue;
							} else {
								// we have a valid identifier
								// switch to implicit expression mode: @myvar().dosomethingelse().prop
								buffers.push( { type: modes.MKP, value: buffer } );
								buffer = ''; // blank out markup buffer;
								mode = modes.EXP;
								continue;
							}
						}
					}
				}
			} else if(TKS.BRACEEND.test(curr) === true) {
				// found } in markup mode, 
				
				identifier = str.substring(0, i+1); // grab from beginning, including }
				identifierMatch = identifier.match(TKS.LBBRACEEND);
				
				if(identifierMatch == null){
					// just a content }, nothing to worry about
					buffer += curr;
				} else {
					// is a } on a new line, assume it's code related to close a block
					// push current markup buffer, exit markup mode, 
					// and let block mode handle it
					
					// rollback cursor to point at char immediately before },
					// to trigger } to be caught in block mode
					i = i - 1;
					buffers.push( { type: modes.MKP, value: buffer } );
					buffer = '';
					mode = modes.BLK;
				}
				
				continue;
				
			} else {
				buffer += curr;
				continue;
			}
		}
	
		if(mode === modes.BLK){
		
			if(TKS.AT.test(curr) === true){
				// current character is @
			
				if(TKS.AT.test(next) === true){
					// escaped @, continue, but ignore one @
					buffer += curr;
					i += 1; // skip next @
				} else {
				
					buffers.push( { type: modes.BLK, value: buffer } );
					buffer = '';
					mode = modes.MKP;
					continue;
				}
			
			} else if(TKS.LT.test(curr) === true){
				// current character is <
			
				if(TKS.TAGOC.test(next) === true){
					// we have a markup tag
					// switch to markup mode
				
					buffers.push( { type: modes.BLK, value: buffer } );
					buffer = curr;
					mode = modes.MKP;
					continue;
				}
			
			} else if(TKS.BRACESTART.test(curr) === true) {
				buffer += curr;
				codeNestLevel += 1;
				continue;

			} else if(TKS.BRACEEND.test(curr) === true) {
				//buffer += curr;
				codeNestLevel -= 1;
				if(codeNestLevel === 0){
					buffer += curr;
					buffers.push( { type: modes.BLK, value: buffer } );
					buffer = '';
					// stay in block mode, since more JS could follow
					continue;
				}
			} 
			
			buffer += curr;
			continue;		
		}
	
		if(mode === modes.EXP){
			// test for identifier
			identifier = str.substring(i);
			identifierMatch = identifier.match( TKS.IDENTIFIER );
		
			if(identifierMatch === null){
				// this is not a variable/property
				// check for @ switch, ( to indicate function call, and [ to indicate indexing
				// if none, must be the end of the expression
				
				if(TKS.AT.test(curr) === true){
					// must just be standalone @, switch to markup mode
					buffer += curr;

					buffers.push( { type: modes.MPK, value: buffer } );
					buffer = ''; // blank out markup buffer;
					mode = modes.MKP;
				} else if( TKS.HARDPARENSTART.test(curr) === true ){
					j = i; // update future cursor in prep for consumption
					consumeUntilMatched(TKS.HARDPARENSTART, TKS.HARDPARENEND);
				} else if( TKS.PARENSTART.test(curr) === true ){
					j = i; // update future cursor in prep for consumption
					consumeUntilMatched(TKS.PARENSTART, TKS.PARENEND);
				} else {
					// this is probably the end of the expression
					
					// end of expression, switch to markup mode
					buffers.push( { type: modes.EXP, value: buffer } );
					buffer = curr;
					mode = modes.MKP;
				}
				
				continue;
				
			} else {
				// found a valid JS identifier
			
				buffer += identifierMatch[0];
				j = i + identifierMatch[0].length;
				//j = i += identifierMatch[0].length; // set i and j to next char after identifier for next iteration
				next = str[j]; // set next to the actual next char after identifier
			
				if(TKS.PARENSTART.test(next) === true){
					// found (, consume until next matching
					i = j; // move i forward
					consumeUntilMatched(TKS.PARENSTART, TKS.PARENEND);
					continue; 

				} else if(TKS.HARDPARENSTART.test(next) === true){
					// found [, consume until next matching
					
					i = j; // move i forward
					consumeUntilMatched(TKS.HARDPARENSTART, TKS.HARDPARENEND);
					continue;

				} else if(TKS.PERIOD.test(next) === true){
					// next char is a .
				
					if( j+1 < str.length && TKS.IDENTIFIER.test( str[j+1] ) ){
						// char after the . is a valid identifier
						// consume ., continue in EXP mode
						buffer += next;
						i = j; // update i to .
						continue;
					} else {
						// do not consume . in code, but in markup
						// end EXP block, continue in markup mode 
					
						buffers.push( { type: modes.EXP, value: buffer } );
						buffer = next; // consume . in markup buffer
						mode = modes.MKP;
						
						i = j; // update i to .
						continue;
					}
				
				} else {
					// just advance i to last char of found identifier
					i = j - 1;
				}
			}
		}
	}

	buffers.push( { type: mode, value: buffer } );
	buffer = ''; // blank out buffer;
	mode = modes.MKP;
	return buffers;

}

function generateTemplate(buffers, useWith){
	var  i
		,current
		,generated = 'var out = "";\n';
	
	for(i = 0; i < buffers.length; i++){
		current = buffers[i];
		
		if(current.type === modes.MKP){
			generated += 'out += \'' + current.value.replace(TKS.QUOTE, '\"').replace(TKS.LINEBREAK, '\\n') + '\';\n';
		}
		
		if(current.type === modes.BLK){
			// nuke new lines, otherwise causes parse error
			generated += current.value.replace(TKS.QUOTE, '\"').replace(TKS.LINEBREAK, '') + '\n';
		}
		
		if(current.type === modes.EXP){
			generated += 'out += (' + current.value.replace(TKS.QUOTE, '\"').replace(TKS.LINEBREAK, '\\n') + ');\n';
		}
	}

	return new Function("model", 
		(useWith === true 
			? "with(model || {}){" + generated + "}" 
			: generated ) + "\nreturn out;");
}

// public interface. keys are quoted to allow for proper export when compressed

var vash = {
	 "_parse": parse
	,"_generate": generateTemplate
	// useWith is optional, defaults to value of vash.config.useWith
	,"tpl": function tpl(str, useWith){
		useWith = (useWith === true || useWith === false)
			? useWith
			: vash.config.useWith;
		var buffs = parse(str);
		return generateTemplate(buffs, useWith);
	}
	,"config": {
		"useWith": true
	}
};

if(typeof module !== 'undefined' && module.exports){
	module["exports"] = vash;
} else {
	root["vash"] = vash;
}

})(this);