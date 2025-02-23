# fugue

Fractional indexing without conflicts - based on [Fugue](https://arxiv.org/abs/2305.00583).

998 bytes (minified and brotlied) and no dependencies.

Fractional indexing is a technique to create an ordering that can be used for [Realtime Editing of Ordered Sequences](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/).

Heavily based on [position-strings](https://github.com/mweidner037/position-strings), with added support for keys that were created by different libraries (e.g. [`fractional-indexing`](https://github.com/rocicorp/fractional-indexing)).

## Installation

```bash
npm install fugue
# or
yarn add fugue
# or
pnpm add fugue
```

## Usage

First, create an instance of `Fugue`. You need to pass in a `clientID`, which is a
unique identifier for the client. This is used to ensure that positions created by
different clients are distinct and non-interleaving.

> The `clientID` should be a string that is unique to the JS runtime. On the server or client,
> this can be created globally with a unique ID (e.g. `nanoid(6)`) and shared across clients.

```ts
import { Fugue } from 'fugue'

// created once in the runtime (this would be a unique ID for the client)
export const fugue = new Fugue('client1')
```

Generate positions between two points using `createBetween`. Pass `null` for start/end to generate positions at the beginning/end:

```ts
import { fugue } from "./fugue";

const first = fugue.createBetween(null, null) // "client1.B"

// Insert after first
const second = fugue.createBetween(first, null) // "client1.D"

// Insert after second
const third = fugue.createBetween(second, null) // "client1.F"

// Insert before first
const zeroth = fugue.createBetween(null, first) // "client1.A0B"

// Insert between second and third (midpoint)
const secondAndHalf = fugue.createBetween(second, third) // "client1.D0B"
```

The biggest benefit of using `fugue` over other fractional indexing libraries is that multiple independent clients
can create keys simultaneously and they will not overlap:

```ts
import { Fugue } from 'fugue'

// first client
const fugue1 = new Fugue('client1');
// second client
const fugue2 = new Fugue('client2');

// create some initial starting first and last 
const first = fugue1.createBetween(null, null); // "client1.B"
const last = fugue1.createBetween(initialFirst, null); // "client1.D"

// simulating these happening in parallel (e.g. across multiple independent clients)
const middle1 = fugue1.createBetween(first, last); // "client1.B0B"
const middle2 = fugue2.createBetween(first, last); // "client1.B,client2.B"
```

## Features

- Generates unique, ordered keys for inserting items between other items.
  - Keys are [global, immutable, grow logarithmically, and non-interleaving](algorithm.md).
- Compatible with positions from other fractional indexing libraries.
- Written in TypeScript with zero dependencies.

## License

[Unlicense](LICENSE)

## Attributions

Thanks to [pgte](https://github.com/pgte) for the NPM package name.
