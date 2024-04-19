const AMPERSAND = "&",
  AMPERSANDEQUAL = "&=",
  ASTERISK = "*",
  ASTERISK2 = "**",
  ASTERISKEQUAL = "*=",
  ASTERISKPERCENT = "*%",
  ASTERISKPERCENTEQUAL = "*%=",
  ASTERISKPIPE = "*|",
  ASTERISKPIPEEQUAL = "*|=",
  CARET = "^",
  CARETEQUAL = "^=",
  COLON = ":",
  COMMA = ",",
  DOT = ".",
  DOT2 = "..",
  DOT3 = "...",
  DOTASTERISK = ".*",
  DOTQUESTIONMARK = ".?",
  EQUAL = "=",
  EQUALEQUAL = "==",
  EQUALRARROW = "=>",
  EXCLAMATIONMARK = "!",
  EXCLAMATIONMARKEQUAL = "!=",
  LARROW = "<",
  LARROW2 = "<<",
  LARROW2PIPE = "<<|",
  LARROW2PIPEEQUAL = "<<|=",
  LARROW2EQUAL = "<<=",
  LARROWEQUAL = "<=",
  LBRACE = "{",
  LBRACKET = "[",
  LPAREN = "(",
  MINUS = "-",
  MINUSEQUAL = "-=",
  MINUSPERCENT = "-%",
  MINUSPERCENTEQUAL = "-%=",
  MINUSPIPE = "-|",
  MINUSPIPEEQUAL = "-|=",
  MINUSRARROW = "->",
  PERCENT = "%",
  PERCENTEQUAL = "%=",
  PIPE = "|",
  PIPE2 = "||",
  PIPEEQUAL = "|=",
  PLUS = "+",
  PLUS2 = "++",
  PLUSEQUAL = "+=",
  PLUSPERCENT = "+%",
  PLUSPERCENTEQUAL = "+%=",
  PLUSPIPE = "+|",
  PLUSPIPEEQUAL = "+|=",
  LETTERC = "c",
  QUESTIONMARK = "?",
  RARROW = ">",
  RARROW2 = ">>",
  RARROW2EQUAL = ">>=",
  RARROWEQUAL = ">=",
  RBRACE = "}",
  RBRACKET = "]",
  RPAREN = ")",
  SEMICOLON = ";",
  SLASH = "/",
  SLASHEQUAL = "/=",
  TILDE = "~",
  PREC = {
    curly: 1,
    assign: 2,
    primary: 3,
    or: 4,
    and: 5,
    comparative: 6,
    bitwise: 7,
    bitshift: 8,
    addition: 9,
    multiply: 10,
    prefix: 11,
  },
  bin = /[01]/,
  bin_ = seq(optional("_"), bin),
  oct = /[0-7]/,
  oct_ = seq(optional("_"), oct),
  hex = /[0-9a-fA-F]/,
  hex_ = seq(optional("_"), hex),
  dec = /[0-9]/,
  dec_ = seq(optional("_"), dec),
  bin_int = seq(bin, repeat(bin_)),
  oct_int = seq(oct, repeat(oct_)),
  dec_int = seq(dec, repeat(dec_)),
  hex_int = seq(hex, repeat(hex_)),
  unescaped_string_fragment = token.immediate(prec(1, /[^"\\\{\}]+/)),
  unescaped_char_fragment = token.immediate(prec(1, /[^'\\]/));

const EscapeSequence = choice(
  seq("\\", choice(/x[0-9a-fA-f]{2}/, /u\{[0-9a-fA-F]+\}/, /[nr\\t'"]/)),
  "{{",
  "}}",
);

const FormatSequence = seq(
  "{",
  /[0-9]*/,
  optional(choice(/[xXsedbocu*!?]{1}/, "any")),
  optional(seq(":", optional(/[^"\\\{\}]{1}[<^>]{1}[0-9]+/), /.{0,1}[0-9]*/)),
  "}",
);

module.exports = grammar({
  name: "zig",

  word: ($) => $._PlainIdent,
  inline: ($) => [$.Variable],
  extras: ($) => [/\s/, $.line_comment],
  conflicts: ($) => [[$.LoopExpr], [$.LoopTypeExpr], [$.SuffixExpr]],
  rules: {
    source_file: ($) =>
      seq(optional($.container_doc_comment), optional($._ContainerMembers)),

    // *** Top level ***
    _ContainerMembers: ($) =>
      choice(
        repeat1($._ContainerDeclarations),
        seq(
          repeat($._ContainerDeclarations),
          $.ContainerField,
          repeat(seq(COMMA, $.ContainerField)),
          optional(seq(COMMA, repeat($._ContainerDeclarations))),
        ),
      ),

    _ContainerDeclarations: ($) =>
      choice(
        $.TestDecl,
        $.ComptimeDecl,
        seq(optional($.doc_comment), optional(keyword("pub", $)), $.Decl),
      ),

    TestDecl: ($) =>
      seq(
        optional($.doc_comment),
        keyword("test", $),
        optional(choice($.STRINGLITERALSINGLE, $.IDENTIFIER)),
        $.Block,
      ),

    ComptimeDecl: ($) => seq(keyword("comptime", $), $.Block),

    Decl: ($) =>
      choice(
        seq(
          optional(
            choice(
              seq(keyword("extern", $), optional($.STRINGLITERALSINGLE)),
              keyword(choice("export", "inline", "noinline"), $),
            ),
          ),
          $.FnProto,
          choice(SEMICOLON, $.Block),
        ),

        seq(
          optional(
            choice(
              keyword("export", $),
              seq(keyword("extern", $), optional($.STRINGLITERALSINGLE)),
            ),
          ),
          optional(keyword("threadlocal", $)),
          $.GlobalVarDecl,
        ),
        seq(keyword("usingnamespace", $), $.Expr, SEMICOLON),
      ),

    GlobalVarDecl: ($) =>
      seq($.VarDeclProto, optional(seq(EQUAL, $.Expr)), SEMICOLON),

    FnProto: ($) =>
      seq(
        keyword("fn", $),
        optional(field("function", $.IDENTIFIER)),
        $.ParamDeclList,
        optional($.ByteAlign),
        optional($.AddrSpace),
        optional($.LinkSection),
        optional($.CallConv),
        optional(field("exception", EXCLAMATIONMARK)),
        $._TypeExpr,
      ),

    VarDeclProto: ($) =>
      seq(
        keyword(choice("const", "var"), $),
        field("variable_type_function", $.IDENTIFIER),
        optional(seq(COLON, $._TypeExpr)),
        optional($.ByteAlign),
        optional($.AddrSpace),
        optional($.LinkSection),
      ),

    ContainerField: ($) =>
      prec(
        PREC.assign,
        seq(
          optional($.doc_comment),
          optional(keyword("comptime", $)),
          optional(seq(field("field_member", $.IDENTIFIER), COLON)),
          $._TypeExpr,
          optional($.ByteAlign),
          optional(seq(EQUAL, $.Expr)),
        ),
      ),

    // *** Block Level ***

    Statement: ($) =>
      prec(
        PREC.curly,
        choice(
          seq("comptime", $.ComptimeStatement),
          seq(
            choice(
              keyword(choice("nosuspend", "defer", "suspend"), $),
              seq(keyword("errdefer", $), optional($.Payload)),
            ),
            $.BlockExprStatement,
          ),
          $.IfStatement,
          $.LabeledStatement,
          $.SwitchExpr,
          $.VarDeclExprStatement,
        ),
      ),

    ComptimeStatement: ($) => choice($.BlockExpr, $.VarDeclExprStatement),

    IfStatement: ($) =>
      choice(
        seq($.IfPrefix, $.BlockExpr, optional($._ElseStatementTail)),
        seq($.IfPrefix, $.AssignExpr, choice(SEMICOLON, $._ElseStatementTail)),
      ),
    _ElseStatementTail: ($) =>
      seq(keyword("else", $), optional($.Payload), $.Statement),

    LabeledStatement: ($) =>
      prec(
        PREC.curly,
        seq(optional($.BlockLabel), choice($.Block, $.LoopStatement)),
      ),

    LoopStatement: ($) =>
      seq(
        optional(keyword("inline", $)),
        choice($.ForStatement, $.WhileStatement),
      ),

    ForStatement: ($) =>
      choice(
        seq($.ForPrefix, $.BlockExpr, optional($._ElseStatementTail)),
        seq($.ForPrefix, $.AssignExpr, choice(SEMICOLON, $._ElseStatementTail)),
      ),

    WhileStatement: ($) =>
      choice(
        seq($.WhilePrefix, $.BlockExpr, optional($._ElseStatementTail)),
        seq(
          $.WhilePrefix,
          $.AssignExpr,
          choice(SEMICOLON, $._ElseStatementTail),
        ),
      ),

    BlockExprStatement: ($) =>
      choice($.BlockExpr, seq($.AssignExpr, SEMICOLON)),

    BlockExpr: ($) => prec(PREC.curly, seq(optional($.BlockLabel), $.Block)),

    VarDeclExprStatement: ($) =>
      choice(
        seq(
          $.VarDeclProto,
          repeat(seq(COMMA, choice($.VarDeclProto, $.Expr))),
          EQUAL,
          $.Expr,
          SEMICOLON,
        ),
        seq(
          $.Expr,
          optional(
            choice(
              seq($.AssignOp, $.Expr),
              seq(
                repeat1(seq(COMMA, choice($.VarDeclProto, $.Expr))),
                EQUAL,
                $.Expr,
              ),
            ),
          ),
          SEMICOLON,
        ),
      ),

    // *** Expression Level ***

    AssignExpr: ($) =>
      prec(
        PREC.assign,
        seq(
          $.Expr,
          optional(
            choice(
              seq($.AssignOp, $.Expr),
              seq(repeat1(seq(COMMA, $.Expr)), EQUAL, $.Expr),
            ),
          ),
        ),
      ),
    SingleAssignExpr: ($) =>
      prec(PREC.assign, seq($.Expr, optional(seq($.AssignOp, $.Expr)))),

    Expr: ($) => choice($.BinaryExpr, $.UnaryExpr, $._PrimaryExpr),

    BinaryExpr: ($) => {
      const table = [
        [PREC.or, "or"],
        [PREC.and, "and"],
        [PREC.comparative, $.CompareOp],
        [PREC.bitwise, $.BitwiseOp],
        [PREC.bitshift, $.BitShiftOp],
        [PREC.addition, $.AdditionOp],
        [PREC.multiply, $.MultiplyOp],
      ];

      return choice(
        ...table.map(([precedence, operator]) =>
          prec.left(
            precedence,
            seq(
              field("left", $.Expr),
              field("operator", operator),
              field("right", $.Expr),
            ),
          ),
        ),
      );
    },

    UnaryExpr: ($) =>
      prec.left(
        PREC.prefix,
        seq(field("operator", $.PrefixOp), field("left", $.Expr)),
      ),

    _PrimaryExpr: ($) =>
      // INFO: This should be right or ErrorUnionExpr give error
      prec.right(
        choice(
          $.AsmExpr,
          $.IfExpr,
          seq(keyword("break", $), optional($.BreakLabel), optional($.Expr)),
          seq(keyword("continue", $), optional($.BreakLabel)),
          seq(keyword(choice("comptime", "nosuspend", "resume"), $), $.Expr),
          seq(keyword("return", $), optional($.Expr)),
          seq(optional($.BlockLabel), $.LoopExpr),
          $.Block,
          $._CurlySuffixExpr,
        ),
      ),

    IfExpr: ($) =>
      prec.right(seq($.IfPrefix, $.Expr, optional($._ElseExprTail))),

    _ElseExprTail: ($) => seq(keyword("else", $), optional($.Payload), $.Expr),

    Block: ($) => seq(LBRACE, repeat($.Statement), RBRACE),

    LoopExpr: ($) =>
      seq(optional(keyword("inline", $)), choice($.ForExpr, $.WhileExpr)),

    ForExpr: ($) =>
      prec.right(seq($.ForPrefix, $.Expr, optional($._ElseExprTail))),

    WhileExpr: ($) =>
      prec.right(seq($.WhilePrefix, $.Expr, optional($._ElseExprTail))),

    _CurlySuffixExpr: ($) =>
      // INFO: solve #1 issue
      prec(PREC.curly, seq($._TypeExpr, optional($.InitList))),

    InitList: ($) =>
      choice(
        seq(LBRACE, sepBy1(COMMA, $.FieldInit), RBRACE),
        seq(LBRACE, sepBy1(COMMA, $.Expr), RBRACE),
        seq(LBRACE, RBRACE),
      ),

    _TypeExpr: ($) => seq(repeat($.PrefixTypeOp), $.ErrorUnionExpr),

    ErrorUnionExpr: ($) =>
      // INFO: This be right or this will parse the code below to ErrorUnionExpr instead of Statement
      //  fn foo3(b: usize) Error!usize {
      //     return b;
      // }
      prec.right(
        seq(
          $.SuffixExpr,
          repeat(seq(field("exception", EXCLAMATIONMARK), $._TypeExpr)),
        ),
      ),

    SuffixExpr: ($) =>
      // INFO: solve #1 issue
      prec.right(
        choice(
          seq(
            optional("async"),
            $._PrimaryTypeExpr,
            repeat($.SuffixOp),
            $.FnCallArguments,
          ),
          seq(
            $._PrimaryTypeExpr,
            repeat(choice($.SuffixOp, $.FnCallArguments)),
          ),
        ),
      ),

    _PrimaryTypeExpr: ($) =>
      prec.right(
        choice(
          seq($.BUILTINIDENTIFIER, $.FnCallArguments),
          $.CHAR_LITERAL,
          $.ContainerDecl,
          seq(DOT, field("field_constant", $.IDENTIFIER)),
          seq(DOT, $.InitList),
          $.ErrorSetDecl,
          $.FLOAT,
          $.FnProto,
          $.GroupedExpr,
          $.LabeledTypeExpr,
          $.IDENTIFIER,
          $.IfTypeExpr,
          $.INTEGER,
          seq(keyword("comptime", $), $._TypeExpr),
          seq(keyword("error", $), DOT, field("field_constant", $.IDENTIFIER)),
          keyword("anyframe", $),
          keyword("unreachable", $),
          $._STRINGLITERAL,
          $.SwitchExpr,
        ),
      ),

    ContainerDecl: ($) =>
      seq(
        optional(keyword(choice("extern", "packed"), $)),
        $._ContainerDeclAuto,
      ),

    ErrorSetDecl: ($) =>
      seq(
        keyword("error", $),
        LBRACE,
        sepBy(
          COMMA,
          seq(optional($.doc_comment), field("error_decl", $.IDENTIFIER)),
        ),
        RBRACE,
      ),

    GroupedExpr: ($) => seq(LPAREN, $.Expr, RPAREN),

    IfTypeExpr: ($) =>
      prec.right(seq($.IfPrefix, $._TypeExpr, optional($._ElseTypeExprTail))),

    _ElseTypeExprTail: ($) =>
      seq(keyword("else", $), optional($.Payload), $._TypeExpr),

    LabeledTypeExpr: ($) =>
      choice(
        seq($.BlockLabel, $.Block),
        seq(optional($.BlockLabel), $.LoopTypeExpr),
      ),

    LoopTypeExpr: ($) =>
      seq(
        optional(keyword("inline", $)),
        choice($.ForTypeExpr, $.WhileTypeExpr),
      ),

    ForTypeExpr: ($) =>
      prec.right(seq($.ForPrefix, $._TypeExpr, optional($._ElseTypeExprTail))),

    WhileTypeExpr: ($) =>
      prec.right(
        seq($.WhilePrefix, $._TypeExpr, optional($._ElseTypeExprTail)),
      ),

    SwitchExpr: ($) =>
      seq(
        keyword("switch", $),
        LPAREN,
        $.Expr,
        RPAREN,
        LBRACE,
        sepBy(COMMA, $.SwitchProng),
        RBRACE,
      ),

    // *** Assembly ***

    AsmExpr: ($) =>
      seq(
        keyword("asm", $),
        optional(keyword("volatile", $)),
        LPAREN,
        $.Expr,
        optional($.AsmOutput),
        RPAREN,
      ),

    AsmOutput: ($) =>
      seq(COLON, sepBy(COMMA, $.AsmOutputItem), optional($.AsmInput)),

    AsmOutputItem: ($) =>
      seq(
        LBRACKET,
        $.Variable,
        RBRACKET,
        $._STRINGLITERAL,
        LPAREN,
        choice(seq(MINUSRARROW, $._TypeExpr), $.Variable),
        RPAREN,
      ),

    AsmInput: ($) =>
      seq(COLON, sepBy(COMMA, $.AsmInputItem), optional($.AsmClobbers)),

    AsmInputItem: ($) =>
      seq(
        LBRACKET,
        $.Variable,
        RBRACKET,
        $._STRINGLITERAL,
        LPAREN,
        $.Expr,
        RPAREN,
      ),

    AsmClobbers: ($) => seq(COLON, sepBy(COMMA, $._STRINGLITERAL)),

    // *** Helper grammar ***
    BreakLabel: ($) => seq(COLON, $.IDENTIFIER),

    BlockLabel: ($) => prec.left(seq(...blockLabel($))),

    FieldInit: ($) =>
      seq(DOT, field("field_member", $.IDENTIFIER), EQUAL, $.Expr),

    WhileContinueExpr: ($) => seq(COLON, LPAREN, $.AssignExpr, RPAREN),

    LinkSection: ($) => seq(keyword("linksection", $), LPAREN, $.Expr, RPAREN),

    AddrSpace: ($) => seq(keyword("addrspace", $), LPAREN, $.Expr, RPAREN),

    // Fn specific
    CallConv: ($) => seq(keyword("callconv", $), LPAREN, $.Expr, RPAREN),

    ParamDecl: ($) =>
      choice(
        seq(
          optional($.doc_comment),
          optional(keyword(choice("noalias", "comptime"), $)),
          optional(seq(field("parameter", $.IDENTIFIER), COLON)),
          $.ParamType,
        ),
        DOT3,
      ),

    ParamType: ($) =>
      prec(PREC.curly, choice(keyword("anytype", $), $._TypeExpr)),

    // Control flow prefixes
    IfPrefix: ($) =>
      seq(keyword("if", $), LPAREN, $.Expr, RPAREN, optional($.PtrPayload)),

    WhilePrefix: ($) =>
      seq(
        keyword("while", $),
        LPAREN,
        $.Expr,
        RPAREN,
        optional($.PtrPayload),
        optional($.WhileContinueExpr),
      ),
    ForPrefix: ($) =>
      seq(
        keyword("for", $),
        LPAREN,
        $.ForArgumentsList,
        RPAREN,
        $.PtrListPayload,
      ),

    // Payloads
    Payload: ($) => seq(PIPE, $.Variable, PIPE),

    PtrPayload: ($) => seq(PIPE, optional(ASTERISK), $.Variable, PIPE),

    PtrIndexPayload: ($) =>
      seq(
        PIPE,
        optional(ASTERISK),
        $.Variable,
        optional(seq(COMMA, $.Variable)),
        PIPE,
      ),

    PtrListPayload: ($) =>
      seq(PIPE, sepBy1(COMMA, seq(optional(ASTERISK), $.Variable)), PIPE),

    // Switch specific
    SwitchProng: ($) =>
      seq(
        optional("inline"),
        $.SwitchCase,
        EQUALRARROW,
        optional($.PtrIndexPayload),
        $.SingleAssignExpr,
      ),

    SwitchCase: ($) => choice(sepBy1(COMMA, $.SwitchItem), keyword("else", $)),

    SwitchItem: ($) => seq($.Expr, optional(seq(DOT3, $.Expr))),

    // For specific
    ForArgumentsList: ($) => sepBy1(COMMA, $.ForItem),

    ForItem: ($) => seq($.Expr, optional(seq(DOT2, optional($.Expr)))),

    AssignOp: (_) =>
      choice(
        ASTERISKEQUAL,
        ASTERISKPIPEEQUAL,
        SLASHEQUAL,
        PERCENTEQUAL,
        PLUSEQUAL,
        PLUSPIPEEQUAL,
        MINUSEQUAL,
        MINUSPIPEEQUAL,
        LARROW2EQUAL,
        LARROW2PIPEEQUAL,
        RARROW2EQUAL,
        AMPERSANDEQUAL,
        CARETEQUAL,
        PIPEEQUAL,
        ASTERISKPERCENTEQUAL,
        PLUSPERCENTEQUAL,
        MINUSPERCENTEQUAL,
        EQUAL,
      ),
    CompareOp: (_) =>
      choice(
        EQUALEQUAL,
        EXCLAMATIONMARKEQUAL,
        LARROW,
        RARROW,
        LARROWEQUAL,
        RARROWEQUAL,
      ),
    BitwiseOp: ($) =>
      choice(
        AMPERSAND,
        CARET,
        PIPE,
        keyword("orelse", $),
        seq(keyword("catch", $), optional($.Payload)),
      ),

    BitShiftOp: (_) => choice(LARROW2, RARROW2, LARROW2PIPE),

    AdditionOp: (_) =>
      choice(
        PLUS,
        MINUS,
        PLUS2,
        PLUSPERCENT,
        MINUSPERCENT,
        PLUSPIPE,
        MINUSPIPE,
      ),

    MultiplyOp: (_) =>
      choice(
        PIPE2,
        ASTERISK,
        SLASH,
        PERCENT,
        ASTERISK2,
        ASTERISKPERCENT,
        ASTERISKPIPE,
      ),

    PrefixOp: ($) =>
      choice(
        EXCLAMATIONMARK,
        MINUS,
        TILDE,
        MINUSPERCENT,
        AMPERSAND,
        keyword("try", $),
        keyword("await", $),
      ),

    PrefixTypeOp: ($) =>
      choice(
        QUESTIONMARK,
        seq(keyword("anyframe", $), MINUSRARROW),
        seq(
          $.SliceTypeStart,
          repeat(
            choice(
              $.ByteAlign,
              $.AddrSpace,
              keyword(choice("const", "volatile", "allowzero"), $),
            ),
          ),
        ),

        seq(
          $.PtrTypeStart,
          repeat(
            choice(
              $.AddrSpace,
              seq(
                keyword("align", $),
                LPAREN,
                $.Expr,
                optional(seq(COLON, $.Expr, COLON, $.Expr)),
                RPAREN,
              ),
              keyword(choice("const", "volatile", "allowzero"), $),
            ),
          ),
        ),
        $.ArrayTypeStart,
      ),

    /*
          Given a sentinel-terminated expression, e.g. `foo[bar..bar: 0]`, note
          how "bar: " resembles the opening of a labeled block; due to that
          label-like syntax, Tree-sitter would try to parse what comes after the
          COLON as a block, which would obviously fail in this case. To work
          around that problem, we'll create a SentinelTerminatedExpr rule which
          starts like the the BlockLabel rule (hence why they share a common
          definition), but ends with an arbitrary Expr instead of a block.
          BlockLabel should have preferential precedence based on its usage sites
          throughout the rest of the grammar, thus this rule effectively serves
          as a fallback for the former.
        */
    _SentinelTerminatedExpr: ($) =>
      choice(
        seq(...blockLabel($), $.Expr),
        seq(COLON, $.Expr),
        seq($.Expr, optional(seq(COLON, $.Expr))),
      ),

    SuffixOp: ($) =>
      choice(
        seq(
          LBRACKET,
          $.Expr,
          optional(seq(DOT2, optional($._SentinelTerminatedExpr))),
          RBRACKET,
        ),
        seq(DOT, $.IDENTIFIER),
        DOTASTERISK,
        DOTQUESTIONMARK,
      ),

    FnCallArguments: ($) => seq(LPAREN, sepBy(COMMA, $.Expr), RPAREN),

    // Ptr specific
    SliceTypeStart: ($) =>
      seq(LBRACKET, optional(seq(COLON, $.Expr)), RBRACKET),

    PtrTypeStart: ($) =>
      choice(
        ASTERISK,
        ASTERISK2,
        seq(
          LBRACKET,
          ASTERISK,
          optional(choice(LETTERC, seq(COLON, $.Expr))),
          RBRACKET,
        ),
      ),

    ArrayTypeStart: ($) =>
      seq(
        LBRACKET,
        choice($.Expr, $.IDENTIFIER),
        optional(DOT2),
        optional(seq(COLON, choice($.Expr, $.IDENTIFIER))),
        RBRACKET,
      ),

    // ContainerDecl specific
    _ContainerDeclAuto: ($) =>
      seq(
        $.ContainerDeclType,
        LBRACE,
        optional($.container_doc_comment),
        optional($._ContainerMembers),
        RBRACE,
      ),

    ContainerDeclType: ($) =>
      choice(
        keyword("opaque", $),
        seq(keyword("struct", $), optional(seq(LPAREN, $.Expr, RPAREN))),
        seq(keyword("enum", $), optional(seq(LPAREN, $.Expr, RPAREN))),
        seq(
          keyword("union", $),
          optional(
            seq(
              LPAREN,
              choice(
                seq(keyword("enum", $), optional(seq(LPAREN, $.Expr, RPAREN))),
                $.Expr,
              ),
              RPAREN,
            ),
          ),
        ),
      ),

    // Alignment
    ByteAlign: ($) => seq(keyword("align", $), LPAREN, $.Expr, RPAREN),

    // Lists
    ParamDeclList: ($) => seq(LPAREN, sepBy(COMMA, $.ParamDecl), RPAREN),

    // *** Tokens ***
    container_doc_comment: (_) =>
      token(repeat1(seq("//!", /[^\n]*/, /[ \n]*/))),
    doc_comment: (_) => token(repeat1(seq("///", /[^\n]*/, /[ \n]*/))),
    line_comment: (_) => token(seq("//", /.*/)),

    CHAR_LITERAL: ($) =>
      token(seq("'", choice(unescaped_char_fragment, EscapeSequence), "'")),

    FLOAT: (_) =>
      token(
        choice(
          seq("0x", hex_int, ".", hex_int, optional(seq(/[pP][-+]?/, dec_int))),
          seq(dec_int, ".", dec_int, optional(seq(/[eE][-+]?/, dec_int))),
          seq("0x", hex_int, /[pP][-+]?/, dec_int),
          seq(dec_int, /[eE][-+]?/, dec_int),
        ),
      ),

    INTEGER: (_) =>
      token(
        choice(
          seq("0b", bin_int),
          seq("0o", oct_int),
          seq("0x", hex_int),
          dec_int,
        ),
      ),

    STRINGLITERALSINGLE: ($) =>
      seq(
        '"',
        repeat(
          choice(
            unescaped_string_fragment,
            EscapeSequence,
            FormatSequence,
            token.immediate("{"),
            token.immediate("}"),
          ),
        ),
        '"',
      ),

    LINESTRING: (_) => seq("\\\\", /[^\n]*/),

    _STRINGLITERAL: ($) =>
      prec.left(choice($.STRINGLITERALSINGLE, repeat1($.LINESTRING))),

    Variable: ($) => field("variable", $.IDENTIFIER),

    IDENTIFIER: ($) => choice($._PlainIdent, seq("@", $.STRINGLITERALSINGLE)),
    _PlainIdent: (_) => /[A-Za-z_][A-Za-z0-9_]*/,

    BUILTINIDENTIFIER: ($) => seq("@", $._PlainIdent),
  },
});

function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)), optional(sep));
}
function keyword(rule, _) {
  return rule;
  // return alias(rule, $.keyword);
}
function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}

/*
  This rule was extracted as a function for the sake of making
  _SentinelTerminatedExpr and BlockLabel share the same definition. Please check
  the comment of _SentinelTerminatedExpr for more context.
*/
function blockLabel($) {
  return [$.IDENTIFIER, COLON];
}
