Hello, content.
<p @model.attr data-bind="and-how: @model.who > @(model.what)">
@model.things.forEach(function(thing) {
  <span>@thing.name</span>
  <@model.how>YEP</@model.how>
  @(function() {
    <p></p>
  }())
});
</p>

var ast = {
  type: 'VashProgram',
  body: [
    {
      type: 'Text',
      value: 'Hello, content.\n'
    },
    {
      type: 'MarkupTag',
      name: 'p',
      attributes: [
        {
          name: '@model.attr',
          left: {
            type: 'Expression',
            value: 'model.attr'
          }
        },
        {
          name: 'data-bind',
          left: {
            type: 'Text',
            value: 'data-bind'
          },
          quoted: 'double',
          right: [
            { type: 'Text', value: 'and-how: ' },
            { type: 'Expression', values: [
              { type: 'Text', value: 'model.who' }
            ] },
            { type: 'Text', value: ' > ' },
            { type: 'ExplicitExpression', values: [
              { type: 'Expression', values: [
                { type: 'Text', value: 'model.what' }
              ] }
            ] },
          ]
        }
      ],
      values: [
        {
          type: 'Text',
          value: '\n'
        },
        {
          type: 'Expression',
          values: [
            { type: 'Text', value: 'model.things.forEach' },
            {
              type: 'Block',
              head: 'function(thing) ',
              tail: null,
              values: [
                {
                  type: 'Text',
                  value: '\n'
                },
                {
                  type: 'MarkupTag',
                  name: 'span',
                  values: [{
                    type: 'Expression',
                    value: 'thing.name'
                  }]
                },
                {
                  type: 'MarkupTag',
                  expression: 'model.how',
                  values: [{
                    type: 'Text',
                    value: 'YEP'
                  }]
                },
                {
                  type: 'Text',
                  value: '\n'
                },
                {
                  type: 'ExplicitExpression',
                  values: [
                    {
                      type: 'Block',
                      head: [
                        { type: 'Text', value: 'function() ' }
                      ],
                      tail: null,
                      values: [
                        {
                          type: 'Text',
                          value: '\n'
                        },
                        {
                          type: 'MarkupTag',
                          name: 'p',
                          values: []
                        }
                      ]
                    },
                    {
                      type: 'ExplicitExpression',
                      values: [] // prints as (), would this need an empty value here?
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

// Markup Node:
{
  type: 'MarkupTag',
  name: 'NODE_NAME',
  void: true|false,
  attributesArea: []
  values: []
  expression: '' // in case of <@tagname>
}

{
  'Program': {
    contains: [
      'Text', 'Expression', 'ExplicitExpression', 'MarkupTag', 'ExplicitBlock', 'Block', 'ATStar'
    ]
  },

  'Text': {
    contains: []
  },

  'Expression': {
    contains: [
      'Text', 'Block'
    ]
  }

  'ExplicitExpression': {
    contains: [
      'Text', 'Block', 'ATStar'
    ]
  },

  'MarkupTag': {
    contains: [
      'Text', 'Expression', 'ExplicitExpression', 'ExplicitBlock', 'MarkupTag', 'ATStar'
    ]
  },

  'ExplicitBlock': {
    contains: [
      'Text', 'MarkupTag', 'ATStar', 'ATColon'
    ]
  }

  'Block': {
    contains: [
      'Text', 'MarkupTag', 'ATStar', 'ATColon'
    ]
  },

  'ATStar': {
    contains: []
  },

  'ATColon': {
    contains: [
      'Text'
    ]
  }
}


var curr;
while(curr = tokens.pop()) {

}