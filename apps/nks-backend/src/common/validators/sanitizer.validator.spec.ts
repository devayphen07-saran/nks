import { SanitizerValidator } from './sanitizer.validator';

describe('SanitizerValidator', () => {
  describe('sanitizeEmail', () => {
    it('trims whitespace and lowercases', () => {
      expect(SanitizerValidator.sanitizeEmail('  User@EXAMPLE.com  ')).toBe('user@example.com');
    });

    it('removes internal spaces', () => {
      expect(SanitizerValidator.sanitizeEmail('u s e r@example.com')).toBe('user@example.com');
    });

    it('returns falsy value as-is', () => {
      expect(SanitizerValidator.sanitizeEmail('')).toBe('');
    });
  });

  describe('sanitizePhoneNumber', () => {
    it('strips dashes, spaces, and parentheses', () => {
      expect(SanitizerValidator.sanitizePhoneNumber('+1 (800) 555-1234')).toBe('+18005551234');
    });

    it('preserves leading +', () => {
      expect(SanitizerValidator.sanitizePhoneNumber('+919876543210')).toBe('+919876543210');
    });

    it('removes all non-digit non-plus characters', () => {
      expect(SanitizerValidator.sanitizePhoneNumber('abc123def')).toBe('123');
    });

    it('returns falsy value as-is', () => {
      expect(SanitizerValidator.sanitizePhoneNumber('')).toBe('');
    });
  });

  describe('sanitizeName', () => {
    it('trims leading and trailing whitespace', () => {
      expect(SanitizerValidator.sanitizeName('  john  ')).toBe('John');
    });

    it('normalizes multiple spaces to one', () => {
      expect(SanitizerValidator.sanitizeName('john  doe')).toBe('John Doe');
    });

    it('title-cases each word', () => {
      expect(SanitizerValidator.sanitizeName('mary jane watson')).toBe('Mary Jane Watson');
    });

    it('lowercases trailing characters in each word', () => {
      expect(SanitizerValidator.sanitizeName('JOHN DOE')).toBe('John Doe');
    });

    it('returns falsy value as-is', () => {
      expect(SanitizerValidator.sanitizeName('')).toBe('');
    });
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect(SanitizerValidator.escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes < and >', () => {
      expect(SanitizerValidator.escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes double quote', () => {
      expect(SanitizerValidator.escapeHtml('"value"')).toBe('&quot;value&quot;');
    });

    it('escapes single quote', () => {
      expect(SanitizerValidator.escapeHtml("it's")).toBe("it&#39;s");
    });

    it('escapes a full XSS payload', () => {
      const input = '<img src="x" onerror=\'alert(1)\'>';
      expect(SanitizerValidator.escapeHtml(input)).not.toContain('<');
      expect(SanitizerValidator.escapeHtml(input)).not.toContain('>');
    });

    it('returns falsy value as-is', () => {
      expect(SanitizerValidator.escapeHtml('')).toBe('');
    });
  });

  describe('sanitizeString', () => {
    it('trims whitespace', () => {
      expect(SanitizerValidator.sanitizeString('  hello  ')).toBe('hello');
    });

    it('truncates to maxLength', () => {
      expect(SanitizerValidator.sanitizeString('hello world', 5)).toBe('hello');
    });

    it('does not truncate when under maxLength', () => {
      expect(SanitizerValidator.sanitizeString('hello', 10)).toBe('hello');
    });

    it('does not truncate when maxLength is not provided', () => {
      expect(SanitizerValidator.sanitizeString('hello world')).toBe('hello world');
    });

    it('returns falsy value as-is', () => {
      expect(SanitizerValidator.sanitizeString('')).toBe('');
    });
  });

  describe('removeControlCharacters', () => {
    it('removes null byte', () => {
      expect(SanitizerValidator.removeControlCharacters('hello\x00world')).toBe('helloworld');
    });

    it('removes newline and carriage return', () => {
      expect(SanitizerValidator.removeControlCharacters('hello\nworld\r')).toBe('helloworld');
    });

    it('removes tab character', () => {
      expect(SanitizerValidator.removeControlCharacters('hello\tworld')).toBe('helloworld');
    });

    it('removes DEL character (0x7F)', () => {
      expect(SanitizerValidator.removeControlCharacters('hello\x7Fworld')).toBe('helloworld');
    });

    it('preserves regular printable characters', () => {
      expect(SanitizerValidator.removeControlCharacters('hello world 123!')).toBe('hello world 123!');
    });

    it('returns falsy value as-is', () => {
      expect(SanitizerValidator.removeControlCharacters('')).toBe('');
    });
  });
});
