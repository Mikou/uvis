let ts = undefined;
let canvas = undefined;
let form = undefined;
let tplCount =0;
var current = null;


const PRECEDENCE = {
  "WHERE": 1,
  "-<": 2, ">-": 2,
  "=": 3, ":": 3, "&": 3,
  "<": 7, ">": 7, //"<=": 7, ">=": 7, "==": 7, "!=": 7,
  "+": 10, "-": 10,
  "*": 20, "/": 20, "%": 20,
};

function isOp(op) {
  var tok = ts.peek();
  return tok && tok.type == "op" && (!op || tok.value == op) && tok;
}

function isEOL(ch) {
  var tok = ts.peek();
  return tok && tok.type == 'EOL' && (!ch || tok.value == ch) && tok;
}

function isPunc(ch) {
  var tok = ts.peek();
  return tok && tok.type == "punc" && (!ch || tok.value == ch) && tok;
}
function skipSeparator() {
  var tok = ts.peek();
  if (tok.type == "separator") ts.next();
  else ts.croak("Expecting a Template Separator : ");
}
function skipEOL() {
  var tok = ts.peek();
  if (tok.type === "EOL") ts.next();
  else ts.croak("Expecting EOL");
}
function skip_punc(ch) {
  if (isPunc(ch)) ts.next();
  else ts.croak("Expecting punctuation: \"" + ch + "\"");
}

function parsePath(expr) {
  var tok = ts.peek();
  var path = {
    type: 'path',
    content: expr
  };
  if(expr.type == 'id') {
    if(isPunc("[")) {
      path.index = delimited("[", "]", parseAtom);
    }
    if(isPunc(".") || isPunc("!")) path.next = parsePath(ts.next());
  } else if(expr.type == 'punc') {
    if(tok.type=='id') path.next = parsePath(ts.next());
  }
  return path;
}

function maybePath(expr) {
  return (isPunc(".") || isPunc("!")) ? parsePath(expr) : expr;
}

// extends an expression as much as possible to the right
function maybeBinary(left, myPrec) {
  var tok = isOp();
  if (tok) {
    var hisPrec = PRECEDENCE[tok.value];
    if (hisPrec > myPrec) {
      ts.next();
      var right = maybeBinary(maybePath(parseAtom()), hisPrec);

      return maybeBinary({
        type     : "binary",
        operator : tok.value,
        left     : left,
        right    : right
      }, myPrec);
    }
  }
  return left;
}

function delimited(start, stop, parser) {
  skip_punc(start);
  var a = parser();
  skip_punc(stop);
  return a;
}

function parseAtom() {
  var tok = ts.next();

  if (tok.type === "id"   ||
      tok.type === "datetime"  ||
      tok.type === "key"  ||
      tok.type === "path" ||
      tok.type === "num"  || 
      tok.type === "str")
    return tok;

  ts.croak("Unexpected token " + JSON.stringify(ts.peek()));
}

function skipSeparator() {
  var tok = ts.peek();
  if (tok.type == "separator") ts.next();
  else ts.croak("Expecting a Template Separator : ");
}

function skipEOL() {
  var tok = ts.peek();
  if (tok.type === "EOL") ts.next();
  else ts.croak("Expecting EOL");
}

function parseFormula () {
  while(!ts.eof() && ts.peek().type !== 'EOL' ){
    return {type:'formula', value: maybeBinary(maybePath(parseAtom()), 0)};
  }
}

function parseProperty () {
  var key = ts.next();
            if(!isOp(":")) throw new Error("semicolon expected");
            ts.next(); // skip semicolon
  var formula = parseFormula();
  return {key: key.value, formula: formula};
}

function parseTemplate () {
  const properties = [];
  const tplDefinition = {};
  const template = form.createTemplate();

  while(!ts.eof() && ts.peek().type !== 'separator') {
    const property = parseProperty();
    tplDefinition[property.key] = property.formula;
    if(!ts.eof()) skipEOL();
  }
  if(!ts.eof() && ts.peek().type === 'separator') skipSeparator();

  for(var key in tplDefinition)
    if (typeof canvas.inspect(false, key) !== 'undefined')
      template.componentType = key;
  if(++tplCount === 1) {
    if(template.componentType === null) {
      template.componentType = 'Canvas';
      if(tplDefinition.hasOwnProperty('Name')) {
        template.name = tplDefinition.Name;
        delete tplDefinition['Name'];
      } else {
        template.name = 'visfilename.vis';
      }
      buildTemplate(template, tplDefinition);
      return;
    } else {

      var rootTpl = form.createTemplate();
      rootTpl.componentType = 'Canvas';
      rootTpl.name = 'visfilename.vis'

      form.setTree(rootTpl);

      buildTemplate(template, tplDefinition);
      return;
    }

  } else {
    if(template.componentType === null)
      throw new Error("The Template number " +tplCount+ " does not define a valid Component Type");
    buildTemplate(template, tplDefinition);
    return;
  }

  function buildTemplate(template, tplDefinition) {
    // when the component type is known, we can check the keys against the component type
    for(var key in tplDefinition) {
      //if(canvas.getPropertyForComponentType(key, template.componentType)) {
      if(canvas.inspect(template.componentType === 'Canvas', template.componentType, key)) {
        template.properties[key] = tplDefinition[key];
      } else {
        if(key === template.componentType) {
          template.name = tplDefinition[key].value.value;
        }
        else if(key === 'Rows') {
          //template.setRows(tplDefinition[key]);
          template.rows = tplDefinition[key];
        } else {
          throw new Error("'" + key + "' is not a valid property name for Component of type " + template.componentType);
        }
      }
    }
    (template.componentType === 'Canvas') ? form.setTree(template) : form.addTemplate(template);
  }
}

function parseForm () {
  while(!ts.eof()) {
    parseTemplate();
  }
  return form;
}

function init (config) {
  tplCount = 0;
  ts     = config.tokenizer;
  canvas = config.canvas;
  form   = config.form;
};

module.exports = {
  init: init,
  parse: parseForm
};

