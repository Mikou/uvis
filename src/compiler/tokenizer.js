
const moment = require('moment');
const validDate = ['D-M-YYYY HH:mm:SS', 'D-M-YYYY', 'HH:mm:SS'];


function TokenStream(input) {
  
  if(!input) throw Error('No formula was provided as an input parameter');

  let current = null;

  return {
    next  : next,
    peek  : peek,
    eof   : eof,
    croak : input.croak
  };

  function is_visComponent(x) {
    return visComponents.indexOf(" " + x + " ") >= 0;
  }
  function isDigit(ch) {
    return /[0-9]/i.test(ch);
  }
  function isIdStart(ch) {
    return /[a-zA-Z]/i.test(ch);
  }
  function isId(ch) {
    return isIdStart(ch) || "0123456789".indexOf(ch) >= 0;
  }
  function isOpChar(ch) {
    return ":+-*/%=&|<>".indexOf(ch) >= 0;
  }
  function isPunc(ch) {
    return "!,;(){}[].".indexOf(ch) >= 0;
  }
  function isWhitespace(ch) {
    return " \t".indexOf(ch) >= 0;
  }
  function readWhile(predicate) {
    var str = "";
    while (!input.eof() && predicate(input.peek())){
      str += input.next();
    }
    return str;
  }
  function readNumber() {
    var has_dot = false;
    var number = readWhile(function(ch){
      if (ch === ".") {
        if (has_dot) return false;
          has_dot = true;
          return true;
        }
      return isDigit(ch);
    });
    return { type: "num", value: parseFloat(number) };
  }

  function maybePath(id) {
    
  }

  function readIdent () {
    const id = readWhile(isId);
    if(id==='WHERE') return {type:'op', value:'WHERE'};
    return {type:'id', value:id};
  }

  /*function readIdentOrPath() {

    const id = readIdent();
    
    if(isPathSeparator(input.peek())) {
      return readIdentOrPath();
    }


    let path = [];
    let id = "";
    let isPath = false;
    while(isPathSeparator(input.peek()) || isId(input.peek())){
      if(input.eof()) break;
      id = readWhile(isId);
      const pathGroup = {};
      pathGroup['id'] = {type:'id', value:id};
      if(isPathSeparator(input.peek())) {
        isPath = true;
        pathGroup['separator'] = {type:'punc', value:input.next()};
      }
      path.push(pathGroup);
    }

    if(id.toUpperCase() === 'WHERE') {
      return {type:"op", value:"WHERE"};
    }

    if(isPath) {
      return { type: 'path', path: path }
    } else {
      return { type: 'id', value: id }
    }
  }*/
  
  function readTemplateSeparator() {
    var ch = input.peek();
    readWhile(function(ch) { return (!input.eof() && ch !== '\n'); });
    input.next();
    return {type:"separator", value: "--"};

  }

  // We use momentJS to ease the parsing of a date
  function readDatetime(format){
    var ch=input.next();

    var date=String();
    while(!input.eof()){
      ch = input.next();
      if(ch==='#') break;
      date+=ch;
    }
    date = moment(date, validDate, true);
    if(!date.isValid()) date = moment(0);

    //date = moment(0);

    return { type: "datetime", value: date};
  }
  
  function readEscaped (end) {
    var escaped = false, str = "";
    input.next();
    while (!input.eof()) {
      var ch = input.next();
      if (escaped) {
        str += ch;
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === end) {
        break;
      } else {
        str += ch;
      }
    }
    return str;
  }
  
  function readPath () {
    return { type: "pathSeparator", value: "."};
  }

  function readString () {
    return { type: "str", value: readEscaped('"') };
  }

  function readOperator() {
      const tok = input.next();
      if(!isOpChar(input.peek())) return {type:"op", value: tok};
      if(tok === "-" && input.peek() === "-") return readTemplateSeparator();
      if(tok === "-" && input.peek() === "<") 
        return {type:"op", value:tok + input.next()};
      if(tok === ">" && input.peek() === "-") 
        return {type:"op", value:tok + input.next()};
    };


  function skipComment () {
    readWhile(function(ch){ return ch != "\n" });
    input.next();
  }

  function readNext() {
    readWhile(isWhitespace);
    if (input.eof()) return null;
    var ch = input.peek();
    // COMMENT (skip it)
    if (ch === "'") {
      skipComment();
      return readNext();
    }
    // DATETIME
    if (ch === "#")     return readDatetime();
    // STRING
    if (ch === '"')     return readString();
    // NUMBER
    if (isDigit(ch))    return readNumber();
    // IDENT
    if (isIdStart(ch))  return readIdent();
    // OPERATOR
    if(isOpChar(ch))    return readOperator();
    // PUNC
    if(isPunc(ch))      return { type:"punc", value: input.next() }
    // EOL
    if (ch === "\n")    return { type:"EOL", value: input.next() }

    input.croak("Can't handle character: " + ch);
  }
  function peek(){
    return current || (current = readNext());
  }
  function next(){
    const tok = current;
    current = null;
    return tok || readNext();
  }
  function eof(){
    return peek() === null;
  }

  function croak(){}
}


export default TokenStream;
