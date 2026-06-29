/**
 * @module @recurrsive/policy/evaluator
 *
 * Simple expression evaluator for policy conditions.
 * Uses a hand-written recursive descent parser — NO eval().
 *
 * Supported operators:
 * - Comparison: ==, !=, >, <, >=, <=
 * - Logical: &&, ||, !
 * - String/Array: in, contains, startsWith, endsWith
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

type TokenType =
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'IDENTIFIER'
  | 'DOT'
  | 'LPAREN'
  | 'RPAREN'
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'LT'
  | 'GTE'
  | 'LTE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'IN'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

/**
 * Tokenise a condition expression string.
 *
 * @param input - The condition string to tokenise
 * @returns Array of tokens
 * @throws {Error} On unexpected characters
 */
function tokenise(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    // Skip whitespace
    if (/\s/.test(input[pos]!)) {
      pos++;
      continue;
    }

    const start = pos;

    // Two-character operators
    const twoChar = input.slice(pos, pos + 2);
    if (twoChar === '==') {
      tokens.push({ type: 'EQ', value: '==', position: start });
      pos += 2;
      continue;
    }
    if (twoChar === '!=') {
      tokens.push({ type: 'NEQ', value: '!=', position: start });
      pos += 2;
      continue;
    }
    if (twoChar === '>=') {
      tokens.push({ type: 'GTE', value: '>=', position: start });
      pos += 2;
      continue;
    }
    if (twoChar === '<=') {
      tokens.push({ type: 'LTE', value: '<=', position: start });
      pos += 2;
      continue;
    }
    if (twoChar === '&&') {
      tokens.push({ type: 'AND', value: '&&', position: start });
      pos += 2;
      continue;
    }
    if (twoChar === '||') {
      tokens.push({ type: 'OR', value: '||', position: start });
      pos += 2;
      continue;
    }

    // Single-character operators
    const ch = input[pos]!;
    if (ch === '>') {
      tokens.push({ type: 'GT', value: '>', position: start });
      pos++;
      continue;
    }
    if (ch === '<') {
      tokens.push({ type: 'LT', value: '<', position: start });
      pos++;
      continue;
    }
    if (ch === '!') {
      tokens.push({ type: 'NOT', value: '!', position: start });
      pos++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: start });
      pos++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: start });
      pos++;
      continue;
    }
    if (ch === '.') {
      tokens.push({ type: 'DOT', value: '.', position: start });
      pos++;
      continue;
    }

    // String literals (double or single quoted)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      pos++; // skip opening quote
      let str = '';
      while (pos < input.length && input[pos] !== quote) {
        if (input[pos] === '\\' && pos + 1 < input.length) {
          pos++; // skip backslash
          str += input[pos]!;
        } else {
          str += input[pos]!;
        }
        pos++;
      }
      if (pos >= input.length) {
        throw new Error(`Unterminated string literal at position ${start}`);
      }
      pos++; // skip closing quote
      tokens.push({ type: 'STRING', value: str, position: start });
      continue;
    }

    // Number literals
    if (/[0-9]/.test(ch) || (ch === '-' && pos + 1 < input.length && /[0-9]/.test(input[pos + 1]!))) {
      let num = '';
      if (ch === '-') {
        num += '-';
        pos++;
      }
      while (pos < input.length && /[0-9.]/.test(input[pos]!)) {
        num += input[pos]!;
        pos++;
      }
      tokens.push({ type: 'NUMBER', value: num, position: start });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (pos < input.length && /[a-zA-Z0-9_]/.test(input[pos]!)) {
        ident += input[pos]!;
        pos++;
      }

      switch (ident) {
        case 'true':
        case 'false':
          tokens.push({ type: 'BOOLEAN', value: ident, position: start });
          break;
        case 'in':
          tokens.push({ type: 'IN', value: 'in', position: start });
          break;
        case 'contains':
          tokens.push({ type: 'CONTAINS', value: 'contains', position: start });
          break;
        case 'startsWith':
          tokens.push({ type: 'STARTS_WITH', value: 'startsWith', position: start });
          break;
        case 'endsWith':
          tokens.push({ type: 'ENDS_WITH', value: 'endsWith', position: start });
          break;
        case 'and':
          tokens.push({ type: 'AND', value: '&&', position: start });
          break;
        case 'or':
          tokens.push({ type: 'OR', value: '||', position: start });
          break;
        case 'not':
          tokens.push({ type: 'NOT', value: '!', position: start });
          break;
        default:
          tokens.push({ type: 'IDENTIFIER', value: ident, position: start });
      }
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${pos}`);
  }

  tokens.push({ type: 'EOF', value: '', position: pos });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser (recursive descent)
// ---------------------------------------------------------------------------

/**
 * A context object from which property paths are resolved.
 * Typically a flattened view of an Opportunity.
 */
export type EvaluationContext = Record<string, unknown>;

/** Internal parsed value types. */
type ExprValue = string | number | boolean | unknown[] | null | undefined;

/**
 * Recursive descent parser and evaluator for policy condition strings.
 */
class Parser {
  private pos = 0;
  private readonly tokens: Token[];
  private readonly context: EvaluationContext;

  constructor(tokens: Token[], context: EvaluationContext) {
    this.tokens = tokens;
    this.context = context;
  }

  /** Peek at the current token without consuming it. */
  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  /** Consume the current token and advance. */
  private advance(): Token {
    const token = this.tokens[this.pos]!;
    this.pos++;
    return token;
  }

  /** Consume a token of the expected type, or throw. */
  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(
        `Expected ${type} at position ${token.position}, got ${token.type} ('${token.value}')`,
      );
    }
    return this.advance();
  }

  /**
   * Parse and evaluate the full expression.
   *
   * @returns The boolean result of evaluation
   */
  evaluate(): boolean {
    const result = this.parseOr();
    this.expect('EOF');
    return Boolean(result);
  }

  /** Grammar: or → and ( '||' and )* */
  private parseOr(): ExprValue {
    let left = this.parseAnd();
    while (this.peek().type === 'OR') {
      this.advance();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  /** Grammar: and → not ( '&&' not )* */
  private parseAnd(): ExprValue {
    let left = this.parseNot();
    while (this.peek().type === 'AND') {
      this.advance();
      const right = this.parseNot();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  /** Grammar: not → '!' not | comparison */
  private parseNot(): ExprValue {
    if (this.peek().type === 'NOT') {
      this.advance();
      const operand = this.parseNot();
      return !operand;
    }
    return this.parseComparison();
  }

  /** Grammar: comparison → primary ( compOp primary )? */
  private parseComparison(): ExprValue {
    let left = this.parsePrimary();
    const token = this.peek();

    switch (token.type) {
      case 'EQ': {
        this.advance();
        const right = this.parsePrimary();
        return left === right;
      }
      case 'NEQ': {
        this.advance();
        const right = this.parsePrimary();
        return left !== right;
      }
      case 'GT': {
        this.advance();
        const right = this.parsePrimary();
        return Number(left) > Number(right);
      }
      case 'LT': {
        this.advance();
        const right = this.parsePrimary();
        return Number(left) < Number(right);
      }
      case 'GTE': {
        this.advance();
        const right = this.parsePrimary();
        return Number(left) >= Number(right);
      }
      case 'LTE': {
        this.advance();
        const right = this.parsePrimary();
        return Number(left) <= Number(right);
      }
      case 'IN': {
        this.advance();
        const right = this.parsePrimary();
        if (Array.isArray(right)) {
          return right.includes(left);
        }
        if (typeof right === 'string' && typeof left === 'string') {
          return right.includes(left);
        }
        return false;
      }
      case 'CONTAINS': {
        this.advance();
        const right = this.parsePrimary();
        if (Array.isArray(left)) {
          return left.includes(right);
        }
        if (typeof left === 'string' && typeof right === 'string') {
          return left.includes(right);
        }
        return false;
      }
      case 'STARTS_WITH': {
        this.advance();
        const right = this.parsePrimary();
        if (typeof left === 'string' && typeof right === 'string') {
          return left.startsWith(right);
        }
        return false;
      }
      case 'ENDS_WITH': {
        this.advance();
        const right = this.parsePrimary();
        if (typeof left === 'string' && typeof right === 'string') {
          return left.endsWith(right);
        }
        return false;
      }
      default:
        return left;
    }
  }

  /** Grammar: primary → STRING | NUMBER | BOOLEAN | identifier | '(' or ')' */
  private parsePrimary(): ExprValue {
    const token = this.peek();

    switch (token.type) {
      case 'STRING':
        this.advance();
        return token.value;

      case 'NUMBER':
        this.advance();
        return parseFloat(token.value);

      case 'BOOLEAN':
        this.advance();
        return token.value === 'true';

      case 'IDENTIFIER': {
        return this.parseIdentifierPath();
      }

      case 'LPAREN': {
        this.advance();
        const result = this.parseOr();
        this.expect('RPAREN');
        return result;
      }

      default:
        throw new Error(
          `Unexpected token ${token.type} ('${token.value}') at position ${token.position}`,
        );
    }
  }

  /**
   * Parse a dotted identifier path (e.g. `severity`, `effort.t_shirt`)
   * and resolve it from the context.
   */
  private parseIdentifierPath(): ExprValue {
    let path = this.advance().value;

    while (this.peek().type === 'DOT') {
      this.advance(); // consume dot
      const next = this.expect('IDENTIFIER');
      path += `.${next.value}`;
    }

    return this.resolvePath(path);
  }

  /**
   * Resolve a dotted path against the context object.
   *
   * @param path - Dot-separated property path
   * @returns The resolved value, or undefined
   */
  private resolvePath(path: string): ExprValue {
    const parts = path.split('.');
    let current: unknown = this.context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current as ExprValue;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a policy condition expression against a context object.
 *
 * @param condition - The condition expression string
 * @param context - An object whose properties are available in the expression
 * @returns The boolean result of evaluating the expression
 * @throws {Error} On parse or evaluation errors
 *
 * @example
 * ```ts
 * evaluateCondition('severity == "critical"', { severity: 'critical' }); // true
 * evaluateCondition('confidence >= 0.8 && effort.t_shirt == "xs"', {
 *   confidence: 0.9,
 *   effort: { t_shirt: 'xs' },
 * }); // true
 * ```
 */
export function evaluateCondition(condition: string, context: EvaluationContext): boolean {
  const tokens = tokenise(condition);
  const parser = new Parser(tokens, context);
  return parser.evaluate();
}
