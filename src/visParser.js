let ts = undefined;
let canvas = undefined;
let form = undefined;
let tplCount =0;
var current = null;


const PRECEDENCE = {
  "=": 1, ":": 1, "&": 1,
  "-<": 2, ">-": 2,
  "WHERE": 3,
  "<": 7, ">": 7, "<=": 7, ">=": 7, "==": 7, "!=": 7,
  "+": 10, "-": 10,
  "*": 20, "/": 20, "%": 20,
};

function is_op(op) {
  var tok = ts.peek();
  return tok && tok.type == "op" && (!op || tok.value == op) && tok;
}

function is_EOL(ch) {
  var tok = ts.peek();
  return tok && tok.type == 'EOL' && (!ch || tok.value == ch) && tok;
}

function isPunc(ch) {
  var tok = ts.peek();
  return tok && tok.type == "punc" && (!ch || tok.value == ch) && tok;
}
function skip_separator() {
  var tok = ts.peek();
  if (tok.type == "separator") ts.next();
  else ts.croak("Expecting a Template Separator : ");
}
function skip_EOL() {
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
    if(isPunc(".") || isPunc("!")) path.next = parsePath(ts.next());
  } else if(expr.type == 'punc') {
    if(tok.type=='id') path.next = parsePath(ts.next());
  }
  
  return path;

  //throw new Error("Not yet implemented");
}

function maybePath(expr) {
  var v = (isPunc(".") || isPunc("!")) ? parsePath(expr) : expr;
  return v;
}

// extends an expression as much as possible to the right
function maybe_binary(left, my_prec) {
  var tok = is_op();
  if (tok) {
    //console.log(PRECEDENCE);
    var his_prec = PRECEDENCE[tok.value];
    if (his_prec > my_prec) {
      ts.next();
      var right = maybe_binary(maybePath(parse_atom()), his_prec);

      return maybe_binary({
        type     : "binary",
        operator : tok.value,
        left     : left,
        right    : right//maybe_binary(parse_atom(), his_prec)
      }, my_prec);
    }
  }
  return left;
}

function delimited(start, stop, separator, parser) {
  var a = [], first = true;
  skip_punc(start);
  while (!ts.eof()) {
    if (isPunc(stop)) break;
    if (first) first = false; else skip_punc(separator);
    if (isPunc(stop)) break;
    a.push(parser());
  }
  skip_punc(stop);
  return a;
}

function parse_atom() {
  var tok = ts.next();

  if (tok.type === "id"   ||
      tok.type === "datetime"  ||
      tok.type === "key"  ||
      tok.type === "path" ||
      tok.type === "num"  || 
      tok.type === "str")
    return tok;

}

function skip_separator() {
  var tok = ts.peek();
  if (tok.type == "separator") ts.next();
  else ts.croak("Expecting a Template Separator : ");
}

function skip_EOL() {
  var tok = ts.peek();
  if (tok.type === "EOL") ts.next();
  else ts.croak("Expecting EOL");
}

function parse_formula () {
  while(!ts.eof() && ts.peek().type !== 'EOL' ){
    return maybe_binary(maybePath(parse_atom()), 0);
  }
}

function parseProperty () {
  var key = ts.next();
            ts.next(); // skip semicolon
  var formula = parse_formula();
  return {key: key.value, formula: formula};
}

// Default form header
const DEFAULT_FORM_HEADER = {
  Name  : 'fileName.vis',
  Width : {type:'num', formula: '640'},
  Height: {type:'num', formula: '480'}
};

// Assuming header keys are constants
const HEADER_KEYS = ['Name', 'Width', 'Height'];

function isHeaderKey (name) {
  for(var k in HEADER_KEYS)
    if(k===name) return true;
  return false;
}

function parseTemplate () {
  const properties = [];
  const tplDefinition = {};
  const template = form.createTemplate();

  while(!ts.eof() && ts.peek().type !== 'separator') {
    const property = parseProperty();
    tplDefinition[property.key] = property.formula;
    if(!ts.eof()) skip_EOL();
  }
  if(!ts.eof() && ts.peek().type === 'separator') skip_separator();


  // Try to determinate the component type
  for(var key in tplDefinition)
    if (typeof canvas.getComponentType(key) !== 'undefined')
      template.setComponentType(key);


  // when we look at the first template
  if(++tplCount === 1) {
    // is it a form header ? (No component type is addressed)
    if(typeof template.getComponentType() === 'undefined') {

      template.setName("Width",      tplDefinition.hasOwnProperty("Name")   ? tplDefinition.Name   : DEFAULT_FORM_HEADER.Name);
      template.setProperty("Width",  tplDefinition.hasOwnProperty("Width")  ? tplDefinition.Width  : DEFAULT_FORM_HEADER.Width);
      template.setProperty("Height", tplDefinition.hasOwnProperty("Height") ? tplDefinition.Height : DEFAULT_FORM_HEADER.Height);

      form.setTree(template);

      return;
    } else {

      var rootTpl = form.createTemplate();
      rootTpl.setName("Name", DEFAULT_FORM_HEADER.Name);
      rootTpl.setName("Width", DEFAULT_FORM_HEADER.Width);
      rootTpl.setName("Height", DEFAULT_FORM_HEADER.Height);

      form.setTree(rootTpl);

      buildTemplate(tplDefinition);
      return;
    }

  } else {
    if(typeof template.getComponentType() === 'undefined')
      throw new Error("The Template number " +tplCount+ " does not define a valid Component Type");

    buildTemplate(tplDefinition);
    return;
  }

  function buildTemplate(tplDefinition) {
    // when the component type is known, we can check the keys against the component type
    for(var key in tplDefinition) {

      if(canvas.getPropertyForComponentType(key, template.getComponentType())) {
        template.setFormulaForProperty(key, tplDefinition[key]);
      } else {
        if(key === template.getComponentType()) {
          template.setName(tplDefinition[key]);
        }
        else if(key === 'Rows') {
          template.setRows(tplDefinition[key]);
        } else {
          throw new Error("'" + key + "' is not a valid property name for Component of type " + template.getComponentType());
        }
      }
    }
  }
}

function parseVisformTemplate () {
  while(!ts.eof()) {
    parseTemplate();
  }
  return form;
}

function init (config) {
  ts     = config.tokenizer;
  canvas = config.canvas;
  form   = config.form;
};

module.exports = {
  init: init,
  parse: parseVisformTemplate
};

