 The name:

 razor 
	> precision, surgical, steel
	> tanto
	> wakizashi
		> WK.tpl()
		> japanese emoticons?
		> _$8 is a valid JS identifier
		> mootools has $$ 
			> double dollars 
			> the 60 billion double dollar man 
				> Vash the Stampede! 
				> vash.tpl()
					> Very Awesome Scripted HTML

# TODO

* make npm package
* implement @* *@
* implement @: text escape
* implement <text> text escape
* implement mode stack for @{} blocks, to avoid extra {} in code generation?
* for each mode, encapsulate into constructor function, each with own buffer, each gets pushed onto master stack
* refactor to remove repeated code
* change regexes to straight string compares where possible for speed
* add modelPropertyName/modelName config option
* add possiblity for useWith configuration from within template? special keyword?
* in code generation, be smarter to avoid extraneous +=