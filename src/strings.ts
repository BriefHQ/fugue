const FIRST = "";
const LAST = "~";

export type FuguePosition<TClientID extends string = string> =
  | `${string}${TClientID}.${string}`
  | typeof FIRST
  | typeof LAST;

export type FugueOptions<TClientID extends string = string> = {
  /**
   * The unique ID for this client.
   */
  clientID: TClientID;
};

export class Fugue<TClientID extends string = string> {
  /**
   * A string that is less than all positions.
   */
  static readonly FIRST = FIRST;
  /**
   * A string that is greater than all positions.
   */
  static readonly LAST = LAST;

  /**
   * The unique ID for this client.
   */
  readonly clientID: TClientID;
  /**
   * The waypoints' long name: `,${clientID}.`.
   */
  private readonly longName: `,${TClientID}.`;
  /**
   * Variant of longName used for a position's first ID: `${clientID}.`.
   * (Otherwise every position would start with a redundant ','.)
   */
  private readonly firstName: `${TClientID}.`;

  /**
   * For each waypoint that we created, maps a prefix (see getPrefix)
   * for that waypoint to its last (most recent) valueSeq.
   * We always store the right-side version (odd valueSeq).
   */
  private lastValueSeqs = new Map<string, number>();
  private readonly maxCachedPrefixes = 1000;

  constructor(clientID: TClientID) {
    const clientIDSanitized = sanitizeClientID(clientID);

    this.longName = `,${clientIDSanitized}.` as const;
    this.firstName = `${clientIDSanitized}.` as const;

    this.clientID = clientIDSanitized;
  }

  /**
   * Returns a new position between `a` and `b`
   * (`a < new < b`).
   *
   * @param a an existing position, or null to insert at the beginning.
   *
   * @param b an existing position, or null to insert at the end.
   */
  createBetween(a: string | null, b: string | null) {
    let left = a;
    let right = b;

    if (left !== null && right !== null && left >= right) {
      console.warn(
        `left must be less than right: ${left} < ${right} - using ${Fugue.FIRST} instead`,
      );

      left = Fugue.FIRST;
    }

    if (right !== null && right > Fugue.LAST) {
      console.warn(
        `right must be less than or equal to LAST: ${right} > ${Fugue.LAST} - using ${Fugue.LAST} instead`,
      );

      right = Fugue.LAST;
    }

    let ans: string;

    if (right !== null && (left === null || right.startsWith(left))) {
      // Left child of right. This always appends a waypoint.
      const ancestor = leftVersion(right);
      ans = this.appendWaypoint(ancestor);
    } else {
      // Right child of left.
      if (left === null) {
        // ancestor is FIRST.
        ans = this.appendWaypoint("");
      } else {
        // Check if we can reuse left's prefix.
        // It needs to be one of ours, and right can't use the same
        // prefix (otherwise we would get ans > right by comparing right's
        // older valueIndex to our new valueIndex).
        const prefix = getPrefix(left);
        const lastValueSeq = prefix
          ? (this.lastValueSeqs.get(prefix) ?? null)
          : null;
        if (
          prefix !== null &&
          lastValueSeq !== null &&
          !(right !== null && right.startsWith(prefix))
        ) {
          // Reuse.
          const valueSeq = nextOddValueSeq(lastValueSeq);
          ans = prefix + stringifyBase52(valueSeq);
          this.lastValueSeqs.set(prefix, valueSeq);
        } else {
          // Append waypoint.
          ans = this.appendWaypoint(left);
        }
      }
    }

    return ans as FuguePosition<TClientID> & {};
  }

  /**
   * Appends a waypoint to the ancestor.
   */
  private appendWaypoint(ancestor: string) {
    let waypointName: string = ancestor === "" ? this.firstName : this.longName;
    // If our ID already appears in ancestor, instead use a short
    // name for the waypoint.
    // Here we use the uniqueness of ',' and '.' to
    // claim that if this.longName (= `,${ID}.`) appears in ancestor, then it
    // must actually be from a waypoint that we created.
    let existing = ancestor.lastIndexOf(this.longName);
    if (ancestor.startsWith(this.firstName)) existing = 0;
    if (existing !== -1) {
      // Find the index of existing among the long-name
      // waypoints, in backwards order. Here we use the fact that
      // each longName ends with '.' and that '.' does not appear otherwise.
      let index = -1;
      for (let i = existing; i < ancestor.length; i++) {
        if (ancestor[i] === ".") index++;
      }
      waypointName = stringifyShortName(index);
    }

    const prefix = ancestor + waypointName;
    const lastValueSeq = this.lastValueSeqs.get(prefix);
    // Use next odd (right-side) valueSeq (1 if it's a new waypoint).
    const valueSeq =
      lastValueSeq === undefined ? 1 : nextOddValueSeq(lastValueSeq);
    this.lastValueSeqs.set(prefix, valueSeq);
    this.cleanupLastValueSeqs(); // Add cleanup check after setting new values
    return prefix + stringifyBase52(valueSeq);
  }

  /**
   * The number of prefixes in the cache.
   */
  get cacheSize() {
    return this.lastValueSeqs.size;
  }

  /**
   * Cleans up the cache of last value sequences.
   */
  private cleanupLastValueSeqs() {
    if (this.lastValueSeqs.size > this.maxCachedPrefixes) {
      // Convert to array, sort by values (most recent first), and take only the most recent entries
      const entries = Array.from(this.lastValueSeqs.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, this.maxCachedPrefixes);

      this.lastValueSeqs = new Map(entries);
    }
  }
}

/**
 * Returns position's *prefix*: the string through the last waypoint
 * name, or equivalently, without the final valueSeq.
 */
export function getPrefix(position: string) {
  // Last waypoint char is the last '.' (for long names) or
  // digit (for short names). Note that neither appear in valueSeq,
  // which is all letters.
  for (let i = position.length - 2; i >= 0; i--) {
    const char = position[i];
    if (char !== undefined && (char === "." || ("0" <= char && char <= "9"))) {
      // i is the last waypoint char, i.e., the end of the prefix.
      return position.slice(0, i + 1);
    }
  }

  return null;
}

/**
 * Returns the variant of position ending with a "left" marker
 * instead of the default "right" marker.
 *
 * I.e., the ancestor for position's left descendants.
 */
export function leftVersion(position: string) {
  const lastWaypointChar = position[position.length - 1];
  if (lastWaypointChar === undefined) {
    return "";
  }
  // We need to subtract one from the (odd) valueSeq, equivalently, from
  // its last base52 digit.
  const last = parseBase52(lastWaypointChar);

  return position.slice(0, -1) + stringifyBase52(last - 1);
}

/**
 * Base 52, except for last digit, which is base 10 using
 * digits. If less than 0, "A".
 */
export function stringifyShortName(n: number) {
  if (n < 0) {
    return "A";
  } else if (n < 10) {
    return String.fromCharCode(48 + n);
  } else {
    return (
      stringifyBase52(Math.floor(n / 10)) + String.fromCharCode(48 + (n % 10))
    );
  }
}

/**
 * Base 52 encoding using letters (with "digits" in order by code point).
 */
export function stringifyBase52(n: number) {
  if (n === 0) {
    return "A";
  }
  const codes: number[] = [];
  while (n > 0) {
    const digit = n % 52;
    codes.unshift((digit >= 26 ? 71 : 65) + digit);
    n = Math.floor(n / 52);
  }
  return String.fromCharCode(...codes);
}

/**
 * Parses a base52 string into a number.
 */
export function parseBase52(s: string) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const digit = code - (code >= 97 ? 71 : 65);
    n = 52 * n + digit;
  }
  return n;
}

const log52 = Math.log(52);

/**
 * Returns the next odd valueSeq in the special sequence.
 * This is equivalent to mapping n to its valueIndex, adding 2,
 * then mapping back.
 *
 * The sequence has the following properties:
 * 1. Each number is a nonnegative integer (however, not all
 * nonnegative integers are enumerated).
 * 2. The numbers' base-52 representations are enumerated in
 * lexicographic order, with no prefixes (i.e., no string
 * representation is a prefix of another).
 * 3. The n-th enumerated number has O(log(n)) base-52 digits.
 *
 * Properties (2) and (3) are analogous to normal counting, except
 * that we order by the (base-52) lexicographic order instead of the
 * usual order by magnitude. It is also the case that
 * the numbers are in order by magnitude, although we do not
 * use this property.
 *
 * The specific sequence is as follows:
 * - Start with 0.
 * - Enumerate 26^1 numbers (A, B, ..., Z).
 * - Add 1, multiply by 52, then enumerate 26^2 numbers
 * (aA, aB, ..., mz).
 * - Add 1, multiply by 52, then enumerate 26^3 numbers
 * (nAA, nAB, ..., tZz).
 * - Repeat this pattern indefinitely, enumerating
 * 26^d d-digit numbers for each d >= 1. Imagining a decimal place
 * in front of each number, each d consumes 2^(-d) of the unit interval,
 * so we never "reach 1" (overflow to d+1 digits when
 * we meant to use d digits).
 */
export function nextOddValueSeq(n: number) {
  const d = n === 0 ? 1 : Math.floor(Math.log(n) / log52) + 1;
  // You can calculate that the last d-digit number is 52^d - 26^d - 1.
  if (n === Math.pow(52, d) - Math.pow(26, d) - 1) {
    // First step is a new length: n -> (n + 1) * 52.
    // Second step is n -> n + 1.
    return (n + 1) * 52 + 1;
  } else {
    // n -> n + 1 twice.
    return n + 2;
  }
}

/**
 * Sanitizes a client ID by removing invalid characters.
 */
export function sanitizeClientID<TClientID extends string>(
  clientID: TClientID,
): TClientID {
  let sanitized = clientID.replace(/[.,]/g, "");

  if (sanitized.length !== clientID.length) {
    console.warn("clientID contains invalid characters");
  }

  while (sanitized >= Fugue.LAST) {
    console.warn(`clientID must be less than ${Fugue.LAST}: ${sanitized}`);
    sanitized = sanitized.slice(0, -1);
  }

  if (sanitized.length === 0) {
    throw new Error("clientID cannot be empty");
  }

  return sanitized as TClientID;
}
