/*
 *  Copyright (C) 2011 by Andrew Petersen
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.   
 *
 */

(function(root){

// ## Razor Template Tokens
var TKS = {
     AT:             /@/
    ,PARENSTART:     /\(/
    ,PARENEND:       /\)/
    ,COLON:          /:/
    ,BRACESTART:     /\{/
    ,BRACEEND:       /\}/
    ,LT:             /</
    ,GT:             />/
    ,HARDPARENSTART: /\[/
    ,HARDPARENEND:   /\]/
    ,PERIOD:         /\./
    ,LINEBREAK:      /[\n\r]/gi
    ,NONWHITESPACE:  /\S/
    ,TAGOC:          /\/|[a-zA-Z]/ // tag open or close, minus <
    ,TAGSTART:       /^<[^\/]{0,0}([a-zA-Z\-\:]*)[\b]?/i
    ,TAGEND:         /^<\/(\S*?[^>])>/i
    ,TAGSELFCLOSE:   /^<[^>]+?\/>/i
    ,EMAILCHARS:     /[a-zA-Z0-9\_]/
    ,IDENTIFIER:     /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*/ // this could be simplifed to not support unicode
    ,RESERVED:       /^case|catch|do|else|finally|for|function|goto|if|instanceof|return|switch|try|typeof|var|while|with/ // these are not all the reserved words in JS, but ones that can be used with @
    ,ATSTARSTART:    /@\*/
    ,ATSTAREND:      /\*@/
    ,TXT:            /^text/

    ,QUOTE:          /[\"']/gi // This is used for template generation, not parsing
};

// Mode Contants: markup, js block, implicit js expression
var modes = { MKP: "MARKUP", BLK: "BLOCK", EXP: "EXPRESSION" };

// ## Custom Exceptions
// for more specific testing
var ERR = {
    BASE: function(msg, cursorPos, str){
        this.message = msg 
            + ' at character ' 
            + str[cursorPos] 
            + ' at position ' 
            + cursorPos + ' in ' 
            + str;
        this.lineNumber = 0;
        this.stack = '';
    }
    ,SYNTAX: function(msg, cursorPos, str){
        ERR.BASE.apply(this, arguments)
        this.name = "SyntaxError";
    }
    ,UNMATCHED: function(msg, cursorPos, str){
        ERR.BASE.apply(this, arguments)
        this.name = "UnmatchedCharacterError";
    }
    ,INVALIDTAG: function(msg, cursorPos, str){
        ERR.BASE.apply(this, arguments)
        this.name = "InvalidTagError";
    }
    ,MALFORMEDHTML: function(msg, cursorPos, str){
        ERR.BASE.apply(this, arguments)
        this.name = "MalformedHtmlError";
    }
};

// custom errors inherit Error
(function(){
    for(var e in ERR){
        if(ERR.hasOwnProperty(e)){
            ERR[e].prototype = new Error();
            ERR[e].constructor = ERR[e];
        }
    }
})()

// ## Simple Stack.
// Yes, a JS array is basically a stack, but this one
// has automatic underflow and null handling.
function Stack(){
    this._stack = []
}

Stack.prototype = {
    push: function(obj){
        this._stack.push(obj);
        return this;
    }
    ,pop: function(){
        if(this._stack.length > 0)
            return this._stack.pop();
        else 
            throw new Error('Stack Underflow');
    }
    ,peek: function(){
        if(this._stack.length > 0){
            return this._stack[ this._stack.length - 1 ]
        } else {
            return null;
        }
    }
    ,doublePeek: function(){
        if(this._stack.length > 1){
            return this._stack[ this._stack.length - 2 ]
        } else {
            return null;
        }
    }
    ,count: function(){
        return this._stack.length;
    }
}

// ## Parse Method
// The bulk of Vash. Accepts a string, returns an array of tokens.
function parse(str){

    // ### Parser state
    var
        // Current immediate, local mode
        mode = modes.MKP 
        // Specifies what the current and past contexts are.
        // A new context is added under two conditions:
        // 1) A BRACESTART ({) is encountered while the parser is in BLK (block)
        // mode. This most often happens with @{}, @for(...){}, @if(...){} etc.
        // 2) A non self-closing HTML tag is encountered while in MKP (markup)
        // mode, and the current block scope is BLK 
        ,blockStack = new Stack()
        // References the current block when needed
        ,block = null
        // Holds the result of a regex testing for a tag name 
        ,tag = null

        // Contains the current in-progress buffer
        ,buffer = ''
        // Contains each separate buffer as contexts are switched
        ,buffers = []

        // Previous, Current, Next characters of the template string
        ,prev
        ,curr
        ,next
        // Cursor, pointing at the current character of the template string
        ,i
        // Future cursor, if needed
        ,j
        
        // Contains a substring of the template string if necessary
        ,identifier = ''
        // Holds the result of a more than single character regex test
        ,identifierMatch = null;

    // ## State-Aware Functions

    /**
     * Adds characters, including the current, to the buffer until 
     * a matched character is found. For example: curr == (, so it
     * would consume until a matching ) is found, being sure they 
     * actually match in case of nested characters.
     * If consume arg === false, then does not consume, and only moves
     * the cursor (i) ahead.
     * This is defined here to allow it to access parser state.
     *
     * @private
     * @param {RegExp} sRe The regex defining the beginning char of the matched sequence
     * @param {RegExp} eRe The regex defining the ending char of the matched sequence
     * @param {bool} consume Defaults to true. If false, does not add the found sequence to the buffer
     * @returns void
     */
    function untilMatched(sRe, eRe, consume){
        
        var groupLevel = 1;
        
        if(consume !== false && consume !== true) { consume = true; }
        
        while( groupLevel > 0 ){
            j += 1;
            curr = str[j];
            if(j < str.length - 1) next = str[j+1];
        
            if(sRe.test(curr) === true) groupLevel += 1;
            if(eRe.test(curr) === true) groupLevel -= 1;
        
            if(j >= str.length) throw new ERR.UNMATCHED('unmatched ' + sRe, j, str);
        }
    
        if(consume === true) buffer += str.substring(i, j+1);
    
        i = j; // Advance i to current char
        curr = str[i]; // curr will be equal to eRe

        if(i < str.length - 1) next = str[i+1]; // Update next value to be actual next char
        else next = null;
    }

    /**
     * Consumes all characters, including the current, through the char 
     * before the char that evaluates to false.
     * Begins testing from curr + 1, and exits leaving i/curr == the 
     * character before the char that evaluated as true.
     *
     * @param  {RegExp} stopRe
     * @param  {bool}  consume  Defaults to true. If false, does not consume, 
     * and only moves the cursor (i) ahead.
     * @return  void 
     */
    function until(stopRe, consume){

        if(consume !== false && consume !== true) { consume = true; }
        
        j = i; // update future cursor
        
        while(stopRe.test(curr) === false){ 
            j += 1; 
            curr = str[j];
            if(curr === undefined) break; // out of string to test against! 
        }
        
        // consume, including current char through char before char that evaluated as true
        if(consume === true) buffer += str.substring(i, j);
        
        i = j - 1; // advance i to char before char that evaluated as false 
        curr = str[i]; // curr will be equal to char before stopRe
        if(i < str.length - 1) next = str[i+1];
        else next = null;
    }

    // 
    /**
     * Looks at the block stack and throws errors if there are any blocks
     * in the stack. Blocks still in the stack at the end of parsing indicate
     * an unclosed *something*.
     *
     * @return  void
     */
    function finalErrorCheck(){
        var entry;

        if(blockStack.count() > 0){
            // there were unclosed tags and/or blocks
            while(blockStack.count() > 0){
                entry = blockStack.pop();

                if(entry.type === modes.MKP){
                    throw new ERR.MALFORMEDHTML(
                        "Missing closing " + entry.tag
                        ,entry.pos
                        ,str);
                }

                if(entry.type === modes.BLK){
                    throw new ERR.SYNTAX("Unclosed code block", entry.pos, str);
                }
            }
        }
    }

    // ### Main Parser Loop
    for(i = 0; i < str.length; i++){
        if(i > 0) prev = str[i-1];
        curr = str[i];
        if(i < str.length - 1) next = str[i+1];
        else next = null;
    
        // #### Markup/Content Mode
        if(mode === modes.MKP){
            
            // Do special check for current + next to be @* comment. @* comments
            // are only possible inside of markup blocks, apparently.
            if(next !== null && TKS.ATSTARSTART.test(curr + next)){
                // current + next = @*
                identifier = str.substring(i);
                identifierMatch = identifier.match(TKS.ATSTAREND);
                if(identifierMatch === null) {
                    throw new ERR.UNMATCHED('Unmatched @* *@ comment', identifierMatch, str);
                }
                // Advance i to @ of *@
                i = i + identifierMatch.index + 1; 
                continue;
            }

            // Current character is @
            if(TKS.AT.test(curr) === true){
                if(i > 0 && TKS.EMAILCHARS.test(prev) === true && TKS.EMAILCHARS.test(next)){
                    // The characters immediately preceeding and succeeding the @ are valid
                    // email address characters.
                    // Assume it's an e-mail address and continue.
                    buffer += curr;
                } else if(TKS.AT.test(next) === true){
                    // Escaped @. Continue, but ignore one @
                    buffer += curr;
                    // Skip next @
                    i += 1; 
                    continue;
                } else if(TKS.BRACESTART.test(next) === true){
                    // Found {, enter block mode
                    buffers.push( { type: modes.MKP, value: buffer } );
                    // Blank out markup buffer;
                    buffer = '';
                    mode = modes.BLK;
                    continue;
                } else if(TKS.PARENSTART.test(next) === true){
                    // End of markup mode, switch to EXP
                    buffers.push( { type: modes.MKP, value: buffer } );
                    // Blank out markup buffer
                    buffer = ''; 
                    mode = modes.EXP;
                    continue;
                } else {
                    // Test for valid JS var identifier
                    identifier = str.substring(i+1); // everything after @
                    identifierMatch = identifier.match( TKS.IDENTIFIER );
                
                    if(identifierMatch === null){
                        // Stay in markup mode.
                        // This is an @escape, for example, a content }.
                        
                        // Add next char to buffer.
                        buffer += next;
                        
                        // Advance cursor to next char
                        i += 1;
                    } else {
                        // Found either a reserved word or a valid JS identifier
                    
                        if(TKS.RESERVED.test(identifierMatch[0]) === true){
                            // Found a reserved word, like while.

                            // Switch to JS Block mode.
                            buffers.push( { type: modes.MKP, value: buffer } );
                            buffer = identifierMatch[0];
                            mode = modes.BLK;

                            // move passed identifier and continue in block mode
                            i += buffer.length; 
                            continue;
                        } else {
                            // We have a valid identifier

                            // Switch to implicit expression mode: @myvar().dosomethingelse().prop
                            buffers.push( { type: modes.MKP, value: buffer } );
                            
                            // Blank out markup buffer;
                            buffer = ''; 
                            mode = modes.EXP;
                            continue;
                        }
                    }
                }

            } else if(TKS.BRACEEND.test(curr) === true){
    
                block = blockStack.peek();
                
                if(block !== null && block.type === modes.MKP){
                    // We're in a markup block, assume } is content
                    buffer += curr;
                    
                } else {
                    // Found } when not in a markup block, assume it's a block closer. switch to BLK
                    buffers.push( { type: modes.MKP, value: buffer } );
                    buffer = '';
                    mode = modes.BLK;
                    
                    // rollback cursor to character before found }
                    i -= 1; 
                }

                continue;
    
            } else if(TKS.LT.test(curr) === true){
                
                block = blockStack.peek();
                
                if(block !== null && block.type === modes.MKP){
                    // We're in a markup block, test to see if this < is the 
                    // beginning of a closing tag that would also close this
                    // markup block.

                    // Test if this is a matching closing tag
                    tag = str.substring(i).match( TKS.TAGEND );
                    
                    if(tag !== null && tag.length === 2 && tag[1] !== ""){
                    
                        // tag[0] is matching string.
                        // tag[1] is capture group === tag name.
                        
                        if(TKS.TXT.test(tag[1]) === true){ 
                            // SPECIAL CASE: tag is a closing </text> tag, which is not meant to be consumed
                            
                            // Update i to >
                            i += 6;

                            // Blank out curr, to prevent consumption of < or >
                            curr = ''; // tricky
                        }
                        
                        if(tag[1] === block.tag){
                            // This tag matches a tag that triggered a markup mode block.
                            // Pop the markup block off the block stack.
                            blockStack.pop();
                        }
                    
                    }
                    
                    // cleanup
                    tag = null;

                } else if(block !== null && block.type === modes.BLK){
                    // The last block was BLK, meaning that if this opening tag is
                    // not a self-closing html tag, then we should create a new block context.
        
                    // Attempt to extract tag name
                    tag = str.substring(i).match( TKS.TAGSTART );

                    if(tag !== null && tag.length === 2 && tag[1] !== ""){
                        // Captured a tag name.
                    
                        // tag[0] is matching string.
                        // tag[1] is capture group === tag name.

                        if(TKS.TAGSELFCLOSE.test(str.substring(i)) === false){
                            // This is not a self-closing tag, create a new markup context
                            blockStack.push({ type: modes.MKP, tag: tag[1], pos: i });
                        }
                    } else {
                        throw new ERR.INVALIDTAG('Invalid tag in code block: ' 
                            + str.substring( i, i + str.substring(i).indexOf('>') + 1 ), i, str);
                    }

                    // SPECIAL CASE:
                    if(TKS.TXT.test(tag[1]) === true){
                        // Found the opening of a text block
                    
                        // Manually advance i passed <text>
                        i += 5;
                    
                        // Blank out curr so it's not added to the buffer by default
                        curr = ''; // this is a bit tricky. 
                    }

                    // cleanup
                    tag = null;
                }
                
                // Consume < or '' (empty string), continue.
                // Empty string is only if a </text> tag was encountered.
                buffer += curr;
                continue;
            } else if(TKS.GT.test(curr) === true){
                // Found a >, signifying the end of a tag.
                // If we're within a code block, switch to BLK mode.
                // If there is more markup, the following < will cause 
                // BLK mode to switch back to MKP
                
                buffer += curr;
                
                block = blockStack.peek();
                
                if(block !== null && block.type === modes.BLK){
                    buffers.push( { type: modes.MKP, value: buffer } );
                    buffer = '';
                    mode = modes.BLK;
                    continue;
                }
                
            } else {
                buffer += curr;
                continue;
            }
        }
    
        // #### Block Mode
        if(mode === modes.BLK){
        
            if(TKS.AT.test(curr) === true){
                // Current character is @
            
                if(TKS.AT.test(next) === true){
                    // Escaped @, continue, but ignore one @
                    buffer += curr;
                    i += 1; // skip next @
                } else if(TKS.COLON.test(next) === true){
                    // Found @:, explicit escape into markup mode
                    buffers.push( { type: modes.BLK, value: buffer } );
                    buffer = '';
                    mode = modes.MKP;
                    i += 1; // advance i to skip :
                    continue;
                } else {
                    // Possible explicit exit out of block mode. 

                    // Rollback i to char before @, and let markup mode delegate.
                    buffers.push( { type: modes.BLK, value: buffer } );
                    buffer = '';
                    mode = modes.MKP;
                    i = i > 1 ? i - 1 : 0;
                    continue;
                }
            
            } else if(TKS.LT.test(curr) === true){
                // Current character is <
  
                if(TKS.TAGOC.test(next) === true){
                    // We have a markup tag, switch to markup mode.
                
                    buffers.push( { type: modes.BLK, value: buffer } );
                    buffer = '';
                    mode = modes.MKP;
                    // rollback i to character before < to let markup mode handle <
                    i -= 1; 

                    continue;
                }
            
            } else if(TKS.BRACESTART.test(curr) === true) {
                buffer += curr;
                blockStack.push({ type: modes.BLK, pos: i })
                continue;

            } else if(TKS.BRACEEND.test(curr) === true) {
                // Current character is }
                
                block = blockStack.peek();
                
                if(block === null || block.type !== modes.BLK){
                    throw new ERR.UNMATCHED('Found closing }, missing opening {', i, str);
                }
                
                // Because we're in a block, assume that } closes this block.
                blockStack.pop();
                buffer += curr;
                
                block = blockStack.peek();
                if(block !== null && block.type === modes.MKP){
                    // The previous block was markup. Switch to that mode implicitly
                    buffers.push( { type: modes.BLK, value: buffer } );
                    buffer = '';
                    mode = modes.MKP;
                }

                continue;
            }
            
            // Default
            buffer += curr;
            continue;       
        }
    
        // #### Expression Mode
        if(mode === modes.EXP){
    
            // Test for identifier
            identifier = str.substring(i);
            identifierMatch = identifier.match( TKS.IDENTIFIER );
        
            if(identifierMatch === null){
                // This is not a variable/property.
                // Check for @ switch, ( to indicate function call, and [ to indicate indexing.
                // If none, must be the end of the expression.
                
                if(TKS.AT.test(curr) === true){
                    // Must just be standalone @, switch to markup mode
                    buffer += curr;

                    buffers.push( { type: modes.MPK, value: buffer } );
                    buffer = ''; // blank out markup buffer;
                    mode = modes.MKP;
                } else if( TKS.HARDPARENSTART.test(curr) === true ){
                    // Update future cursor in prep for consumption
                    j = i; 
                    untilMatched(TKS.HARDPARENSTART, TKS.HARDPARENEND);
                } else if( TKS.PARENSTART.test(curr) === true ){
                    // Update future cursor in prep for consumption
                    j = i; 
                    untilMatched(TKS.PARENSTART, TKS.PARENEND);
                } else {
                    // This is probably the end of the expression.
                    
                    // Switch to markup mode
                    buffers.push( { type: modes.EXP, value: buffer } );
                    buffer = ''; // blank out buffer
                    mode = modes.MKP;
                    // roll cursor back one to allow markup mode to handle 
                    i -= 1; 
                }
                
                continue;
                
            } else {
                // Found a valid JS identifier
            
                buffer += identifierMatch[0];
                j = i + identifierMatch[0].length;
                // Set next to the actual next char after identifier
                next = str[j]; 
            
                if(TKS.PARENSTART.test(next) === true){
                    // Found (, consume until next matching

                    i = j; // move i forward
                    untilMatched(TKS.PARENSTART, TKS.PARENEND);
                    continue; 

                } else if(TKS.HARDPARENSTART.test(next) === true){
                    // Found [, consume until next matching
                    
                    i = j; // move i forward
                    untilMatched(TKS.HARDPARENSTART, TKS.HARDPARENEND);
                    continue;

                } else if(TKS.PERIOD.test(next) === true){
                    // Next char is a .
                
                    if( j+1 < str.length && TKS.IDENTIFIER.test( str[j+1] ) ){
                        // Char after the . is a valid identifier.
                        // Consume . and continue in EXP mode.
                        buffer += next;
                        // Update i to .
                        i = j;
                        continue;
                    } else {
                        // Do not consume . in code, but in markup.
                        // End EXP block, continue in markup mode.
                    
                        buffers.push( { type: modes.EXP, value: buffer } );
                        buffer = next; // consume . in markup buffer
                        mode = modes.MKP;
                        
                        // Update i to .
                        i = j; 
                        continue;
                    }
                
                } else {
                    // Just advance i to last char of found identifier.
                    i = j - 1;
                }
            }
        }
    }

    finalErrorCheck();

    buffers.push( { type: mode, value: buffer } );
    buffer = ''; // blank out buffer;
    mode = modes.MKP;
    return buffers;

}

// ## Code Generation

/**
 * undocumented function
 *
 * @param  {array} buffers  an array of buffer tokens to create a compiled template from
 * @param  {bool}  useWith  Defaults to false. If true, wraps the template content in a with(){} statement 
 * @param  {string}  modelName  the identifier to use for the "model", if useWith is false
 * @return  void   desc
 */
function generateTemplate(buffers, useWith, modelName){
    var  i
        ,previous = null
        ,current = null
        ,generated = 'var out = "";\n';
    
    for(i = 0; i < buffers.length; i++){
        previous = current;
        current = buffers[i];
        
        if(current.type === modes.MKP){
            generated += 
                (previous !== null && (previous.type === modes.MKP || previous.type === modes.EXP) 
                    ? '+' 
                    : 'out += ') 
                + '\'' 
                + current.value
                    .replace(TKS.QUOTE, '\"')
                    .replace(TKS.LINEBREAK, '\\n') 
                + '\'\n';
        }
        
        if(current.type === modes.BLK){
            // Nuke new lines, otherwise causes parse error
            generated += current.value
                .replace(TKS.QUOTE, '\"')
                .replace(TKS.LINEBREAK, '') + '\n';
        }
        
        if(current.type === modes.EXP){
            generated += 
                (previous !== null && (previous.type === modes.MKP || previous.type === modes.EXP) 
                    ? '+' 
                    : 'out +=') 
                + ' (' 
                + current.value
                    .replace(TKS.QUOTE, '\"')
                    .replace(TKS.LINEBREAK, '\\n') 
                + ')\n';
        }
    }
    
    return new Function(modelName, 
        (useWith === true 
            ? "with(" + modelName + " || {}){" + generated + "}" 
            : generated ) + "\nreturn out;");
}

// ## Public Interface / Export
// Keys are quoted to allow for proper export when compressed.

var vash = {
     "_err": ERR
    ,"_parse": parse
    ,"_generate": generateTemplate
    ,"tpl": function tpl(str, useWith){
        // useWith is optional, defaults to value of vash.config.useWith
        useWith = (useWith === true || useWith === false)
            ? useWith
            : vash.config.useWith;
        var buffs = parse(str);
        return generateTemplate(buffs, useWith, vash.config.modelName);
    }
    ,"config": {
         "useWith": true
        ,"modelName": "model"
    }
};

if(typeof module !== 'undefined' && module.exports){
    module["exports"] = vash;
} else {
    root["vash"] = vash;
}

})(this);