// ExpressionBlock inherent return
// CodeBlock // 
// MarkupBlock

//<a>@model.map(function(l){ return "__" + l + "__";  }).forEach(function(l){ <b>@l</b> })</a>

/* 
	type: MARKUP
	starter: <a>
	children: [
		{ 
			type: EXPRESSION
			starter: @model.map(
			children: [
				{
					type: BLOCK
					starter: function(l){
					children: [
						{
							type: BLOCK
							starter: return "__" + l + "__";
						}
					]
					stopper: }
				}
			]
			stopper: )
		}
		{
			type:EXPRESSION
			starter: .forEach(
			children: [
				{
					type: BLOCK
					starter: function(l){
					children: [
						type: MARKUP
						starter: <b>
						children: [
							{
								type: EXPRESSION
								starter: l
								stopper: ''
							}
						]
						stopper: </b>
					]
					stopper: }
				}
			]
			stopper: )
		}
	]
	stopper: </a>
*/

function VASTNode(){
	this.name = '';
	this.starter = null;
	this.children = [];
	this.stopper = null;
}

var VASTNodeP = VASTNode.prototype;


