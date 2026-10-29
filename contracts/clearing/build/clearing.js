function _applyDecoratedDescriptor(i, e, r, n, l) {
  var a = {};
  return Object.keys(n).forEach(function (i) {
    a[i] = n[i];
  }), a.enumerable = !!a.enumerable, a.configurable = !!a.configurable, ("value" in a || a.initializer) && (a.writable = !0), a = r.slice().reverse().reduce(function (r, n) {
    return n(i, e, r) || r;
  }, a), l && void 0 !== a.initializer && (a.value = a.initializer ? a.initializer.call(l) : void 0, a.initializer = void 0), void 0 === a.initializer ? (Object.defineProperty(i, e, a), null) : a;
}

// make PromiseIndex a nominal typing
var PromiseIndexBrand;
(function (PromiseIndexBrand) {
  PromiseIndexBrand[PromiseIndexBrand["_"] = -1] = "_";
})(PromiseIndexBrand || (PromiseIndexBrand = {}));
const TYPE_KEY = "typeInfo";
var TypeBrand;
(function (TypeBrand) {
  TypeBrand["BIGINT"] = "bigint";
  TypeBrand["DATE"] = "date";
})(TypeBrand || (TypeBrand = {}));
const ERR_INCONSISTENT_STATE = "The collection is an inconsistent state. Did previous smart contract execution terminate unexpectedly?";
const ERR_INDEX_OUT_OF_BOUNDS = "Index out of bounds";
const ACCOUNT_ID_REGEX = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
/**
 * Asserts that the expression passed to the function is truthy, otherwise throws a new Error with the provided message.
 *
 * @param expression - The expression to be asserted.
 * @param message - The error message to be printed.
 */
function assert(expression, message) {
  if (!expression) {
    throw new Error("assertion failed: " + message);
  }
}
function getValueWithOptions(value, options = {
  deserializer: deserialize
}) {
  if (value === null) {
    return options?.defaultValue ?? null;
  }
  const deserialized = deserialize(value);
  if (deserialized === undefined || deserialized === null) {
    return options?.defaultValue ?? null;
  }
  if (options?.reconstructor) {
    return options.reconstructor(deserialized);
  }
  return deserialized;
}
function serializeValueWithOptions(value, {
  serializer
} = {
  serializer: serialize
}) {
  return serializer(value);
}
function serialize(valueToSerialize) {
  return encode(JSON.stringify(valueToSerialize, function (key, value) {
    if (typeof value === "bigint") {
      return {
        value: value.toString(),
        [TYPE_KEY]: TypeBrand.BIGINT
      };
    }
    if (typeof this[key] === "object" && this[key] !== null && this[key] instanceof Date) {
      return {
        value: this[key].toISOString(),
        [TYPE_KEY]: TypeBrand.DATE
      };
    }
    return value;
  }));
}
function deserialize(valueToDeserialize) {
  return JSON.parse(decode(valueToDeserialize), (_, value) => {
    if (value !== null && typeof value === "object" && Object.keys(value).length === 2 && Object.keys(value).every(key => ["value", TYPE_KEY].includes(key))) {
      switch (value[TYPE_KEY]) {
        case TypeBrand.BIGINT:
          return BigInt(value["value"]);
        case TypeBrand.DATE:
          return new Date(value["value"]);
      }
    }
    return value;
  });
}
/**
 * Validates the Account ID according to the NEAR protocol
 * [Account ID rules](https://nomicon.io/DataStructures/Account#account-id-rules).
 *
 * @param accountId - The Account ID string you want to validate.
 */
function validateAccountId(accountId) {
  return accountId.length >= 2 && accountId.length <= 64 && ACCOUNT_ID_REGEX.test(accountId);
}
/**
 * Convert a string to Uint8Array, each character must have a char code between 0-255.
 * @param s - string that with only Latin1 character to convert
 * @returns result Uint8Array
 */
function bytes(s) {
  return env.latin1_string_to_uint8array(s);
}
/**
 * Convert a Uint8Array to string, each uint8 to the single character of that char code
 * @param a - Uint8Array to convert
 * @returns result string
 */
function str(a) {
  return env.uint8array_to_latin1_string(a);
}
/**
 * Encode the string to Uint8Array with UTF-8 encoding
 * @param s - String to encode
 * @returns result Uint8Array
 */
function encode(s) {
  return env.utf8_string_to_uint8array(s);
}
/**
 * Decode the Uint8Array to string in UTF-8 encoding
 * @param a - array to decode
 * @returns result string
 */
function decode(a) {
  return env.uint8array_to_utf8_string(a);
}

var CurveType;
(function (CurveType) {
  CurveType[CurveType["ED25519"] = 0] = "ED25519";
  CurveType[CurveType["SECP256K1"] = 1] = "SECP256K1";
})(CurveType || (CurveType = {}));
var DataLength;
(function (DataLength) {
  DataLength[DataLength["ED25519"] = 32] = "ED25519";
  DataLength[DataLength["SECP256K1"] = 64] = "SECP256K1";
})(DataLength || (DataLength = {}));

/**
 * A Promise result in near can be one of:
 * - NotReady = 0 - the promise you are specifying is still not ready, not yet failed nor successful.
 * - Successful = 1 - the promise has been successfully executed and you can retrieve the resulting value.
 * - Failed = 2 - the promise execution has failed.
 */
var PromiseResult;
(function (PromiseResult) {
  PromiseResult[PromiseResult["NotReady"] = 0] = "NotReady";
  PromiseResult[PromiseResult["Successful"] = 1] = "Successful";
  PromiseResult[PromiseResult["Failed"] = 2] = "Failed";
})(PromiseResult || (PromiseResult = {}));
/**
 * A promise error can either be due to the promise failing or not yet being ready.
 */
var PromiseError;
(function (PromiseError) {
  PromiseError[PromiseError["Failed"] = 0] = "Failed";
  PromiseError[PromiseError["NotReady"] = 1] = "NotReady";
})(PromiseError || (PromiseError = {}));

const U64_MAX = 2n ** 64n - 1n;
const EVICTED_REGISTER = U64_MAX - 1n;
/**
 * Returns the account ID of the account that called the function.
 * Can only be called in a call or initialize function.
 */
function predecessorAccountId() {
  env.predecessor_account_id(0);
  return str(env.read_register(0));
}
/**
 * Returns the account ID of the current contract - the contract that is being executed.
 */
function currentAccountId() {
  env.current_account_id(0);
  return str(env.read_register(0));
}
/**
 * Returns the current block timestamp.
 */
function blockTimestamp() {
  return env.block_timestamp();
}
/**
 * Returns the amount of NEAR attached to this function call.
 * Can only be called in payable functions.
 */
function attachedDeposit() {
  return env.attached_deposit();
}
/**
 * Reads the value from NEAR storage that is stored under the provided key.
 *
 * @param key - The key to read from storage.
 */
function storageReadRaw(key) {
  const returnValue = env.storage_read(key, 0);
  if (returnValue !== 1n) {
    return null;
  }
  return env.read_register(0);
}
/**
 * Reads the utf-8 string value from NEAR storage that is stored under the provided key.
 *
 * @param key - The utf-8 string key to read from storage.
 */
function storageRead(key) {
  const ret = storageReadRaw(encode(key));
  if (ret !== null) {
    return decode(ret);
  }
  return null;
}
/**
 * Checks for the existance of a value under the provided key in NEAR storage.
 *
 * @param key - The key to check for in storage.
 */
function storageHasKeyRaw(key) {
  return env.storage_has_key(key) === 1n;
}
/**
 * Checks for the existance of a value under the provided utf-8 string key in NEAR storage.
 *
 * @param key - The utf-8 string key to check for in storage.
 */
function storageHasKey(key) {
  return storageHasKeyRaw(encode(key));
}
/**
 * Get the last written or removed value from NEAR storage.
 */
function storageGetEvictedRaw() {
  return env.read_register(EVICTED_REGISTER);
}
/**
 * Writes the provided bytes to NEAR storage under the provided key.
 *
 * @param key - The key under which to store the value.
 * @param value - The value to store.
 */
function storageWriteRaw(key, value) {
  return env.storage_write(key, value, EVICTED_REGISTER) === 1n;
}
/**
 * Writes the provided utf-8 string to NEAR storage under the provided key.
 *
 * @param key - The utf-8 string key under which to store the value.
 * @param value - The utf-8 string value to store.
 */
function storageWrite(key, value) {
  return storageWriteRaw(encode(key), encode(value));
}
/**
 * Removes the value of the provided key from NEAR storage.
 *
 * @param key - The key to be removed.
 */
function storageRemoveRaw(key) {
  return env.storage_remove(key, EVICTED_REGISTER) === 1n;
}
/**
 * Removes the value of the provided utf-8 string key from NEAR storage.
 *
 * @param key - The utf-8 string key to be removed.
 */
function storageRemove(key) {
  return storageRemoveRaw(encode(key));
}
/**
 * Returns the arguments passed to the current smart contract call.
 */
function inputRaw() {
  env.input(0);
  return env.read_register(0);
}
/**
 * Returns the arguments passed to the current smart contract call as utf-8 string.
 */
function input() {
  return decode(inputRaw());
}
/**
 * Create a NEAR promise which will have multiple promise actions inside.
 *
 * @param accountId - The account ID of the target contract.
 */
function promiseBatchCreate(accountId) {
  return env.promise_batch_create(accountId);
}
/**
 * Attach a transfer promise action to the NEAR promise index with the provided promise index.
 *
 * @param promiseIndex - The index of the promise to attach a transfer action to.
 * @param amount - The amount of NEAR to transfer.
 */
function promiseBatchActionTransfer(promiseIndex, amount) {
  env.promise_batch_action_transfer(promiseIndex, amount);
}
/**
 * Executes the promise in the NEAR WASM virtual machine.
 *
 * @param promiseIndex - The index of the promise to execute.
 */
function promiseReturn(promiseIndex) {
  env.promise_return(promiseIndex);
}

/**
 * A lookup map that stores data in NEAR storage.
 */
class LookupMap {
  /**
   * @param keyPrefix - The byte prefix to use when storing elements inside this collection.
   */
  constructor(keyPrefix) {
    this.keyPrefix = keyPrefix;
  }
  /**
   * Checks whether the collection contains the value.
   *
   * @param key - The value for which to check the presence.
   */
  containsKey(key) {
    const storageKey = this.keyPrefix + key;
    return storageHasKey(storageKey);
  }
  /**
   * Get the data stored at the provided key.
   *
   * @param key - The key at which to look for the data.
   * @param options - Options for retrieving the data.
   */
  get(key, options) {
    const storageKey = this.keyPrefix + key;
    const value = storageReadRaw(encode(storageKey));
    return getValueWithOptions(value, options);
  }
  /**
   * Removes and retrieves the element with the provided key.
   *
   * @param key - The key at which to remove data.
   * @param options - Options for retrieving the data.
   */
  remove(key, options) {
    const storageKey = this.keyPrefix + key;
    if (!storageRemove(storageKey)) {
      return options?.defaultValue ?? null;
    }
    const value = storageGetEvictedRaw();
    return getValueWithOptions(value, options);
  }
  /**
   * Store a new value at the provided key.
   *
   * @param key - The key at which to store in the collection.
   * @param newValue - The value to store in the collection.
   * @param options - Options for retrieving and storing the data.
   */
  set(key, newValue, options) {
    const storageKey = this.keyPrefix + key;
    const storageValue = serializeValueWithOptions(newValue, options);
    if (!storageWriteRaw(encode(storageKey), storageValue)) {
      return options?.defaultValue ?? null;
    }
    const value = storageGetEvictedRaw();
    return getValueWithOptions(value, options);
  }
  /**
   * Extends the current collection with the passed in array of key-value pairs.
   *
   * @param keyValuePairs - The key-value pairs to extend the collection with.
   * @param options - Options for storing the data.
   */
  extend(keyValuePairs, options) {
    for (const [key, value] of keyValuePairs) {
      this.set(key, value, options);
    }
  }
  /**
   * Serialize the collection.
   *
   * @param options - Options for storing the data.
   */
  serialize(options) {
    return serializeValueWithOptions(this, options);
  }
  /**
   * Converts the deserialized data from storage to a JavaScript instance of the collection.
   *
   * @param data - The deserialized data to create an instance from.
   */
  static reconstruct(data) {
    return new LookupMap(data.keyPrefix);
  }
}

function indexToKey(prefix, index) {
  const data = new Uint32Array([index]);
  const array = new Uint8Array(data.buffer);
  const key = str(array);
  return prefix + key;
}
/**
 * An iterable implementation of vector that stores its content on the trie.
 * Uses the following map: index -> element
 */
class Vector {
  /**
   * @param prefix - The byte prefix to use when storing elements inside this collection.
   * @param length - The initial length of the collection. By default 0.
   */
  constructor(prefix, length = 0) {
    this.prefix = prefix;
    this.length = length;
  }
  /**
   * Checks whether the collection is empty.
   */
  isEmpty() {
    return this.length === 0;
  }
  /**
   * Get the data stored at the provided index.
   *
   * @param index - The index at which to look for the data.
   * @param options - Options for retrieving the data.
   */
  get(index, options) {
    if (index >= this.length) {
      return options?.defaultValue ?? null;
    }
    const storageKey = indexToKey(this.prefix, index);
    const value = storageReadRaw(bytes(storageKey));
    return getValueWithOptions(value, options);
  }
  /**
   * Removes an element from the vector and returns it in serialized form.
   * The removed element is replaced by the last element of the vector.
   * Does not preserve ordering, but is `O(1)`.
   *
   * @param index - The index at which to remove the element.
   * @param options - Options for retrieving and storing the data.
   */
  swapRemove(index, options) {
    assert(index < this.length, ERR_INDEX_OUT_OF_BOUNDS);
    if (index + 1 === this.length) {
      return this.pop(options);
    }
    const key = indexToKey(this.prefix, index);
    const last = this.pop(options);
    assert(storageWriteRaw(bytes(key), serializeValueWithOptions(last, options)), ERR_INCONSISTENT_STATE);
    const value = storageGetEvictedRaw();
    return getValueWithOptions(value, options);
  }
  /**
   * Adds data to the collection.
   *
   * @param element - The data to store.
   * @param options - Options for storing the data.
   */
  push(element, options) {
    const key = indexToKey(this.prefix, this.length);
    this.length += 1;
    storageWriteRaw(bytes(key), serializeValueWithOptions(element, options));
  }
  /**
   * Removes and retrieves the element with the highest index.
   *
   * @param options - Options for retrieving the data.
   */
  pop(options) {
    if (this.isEmpty()) {
      return options?.defaultValue ?? null;
    }
    const lastIndex = this.length - 1;
    const lastKey = indexToKey(this.prefix, lastIndex);
    this.length -= 1;
    assert(storageRemoveRaw(bytes(lastKey)), ERR_INCONSISTENT_STATE);
    const value = storageGetEvictedRaw();
    return getValueWithOptions(value, options);
  }
  /**
   * Replaces the data stored at the provided index with the provided data and returns the previously stored data.
   *
   * @param index - The index at which to replace the data.
   * @param element - The data to replace with.
   * @param options - Options for retrieving and storing the data.
   */
  replace(index, element, options) {
    assert(index < this.length, ERR_INDEX_OUT_OF_BOUNDS);
    const key = indexToKey(this.prefix, index);
    assert(storageWriteRaw(bytes(key), serializeValueWithOptions(element, options)), ERR_INCONSISTENT_STATE);
    const value = storageGetEvictedRaw();
    return getValueWithOptions(value, options);
  }
  /**
   * Extends the current collection with the passed in array of elements.
   *
   * @param elements - The elements to extend the collection with.
   */
  extend(elements) {
    for (const element of elements) {
      this.push(element);
    }
  }
  [Symbol.iterator]() {
    return new VectorIterator(this);
  }
  /**
   * Create a iterator on top of the default collection iterator using custom options.
   *
   * @param options - Options for retrieving and storing the data.
   */
  createIteratorWithOptions(options) {
    return {
      [Symbol.iterator]: () => new VectorIterator(this, options)
    };
  }
  /**
   * Return a JavaScript array of the data stored within the collection.
   *
   * @param options - Options for retrieving and storing the data.
   */
  toArray(options) {
    const array = [];
    const iterator = options ? this.createIteratorWithOptions(options) : this;
    for (const value of iterator) {
      array.push(value);
    }
    return array;
  }
  /**
   * Remove all of the elements stored within the collection.
   */
  clear() {
    for (let index = 0; index < this.length; index++) {
      const key = indexToKey(this.prefix, index);
      storageRemoveRaw(bytes(key));
    }
    this.length = 0;
  }
  /**
   * Serialize the collection.
   *
   * @param options - Options for storing the data.
   */
  serialize(options) {
    return serializeValueWithOptions(this, options);
  }
  /**
   * Converts the deserialized data from storage to a JavaScript instance of the collection.
   *
   * @param data - The deserialized data to create an instance from.
   */
  static reconstruct(data) {
    const vector = new Vector(data.prefix, data.length);
    return vector;
  }
}
/**
 * An iterator for the Vector collection.
 */
class VectorIterator {
  /**
   * @param vector - The vector collection to create an iterator for.
   * @param options - Options for retrieving and storing data.
   */
  constructor(vector, options) {
    this.vector = vector;
    this.options = options;
    this.current = 0;
  }
  next() {
    if (this.current >= this.vector.length) {
      return {
        value: null,
        done: true
      };
    }
    const value = this.vector.get(this.current, this.options);
    this.current += 1;
    return {
      value,
      done: false
    };
  }
}

/**
 * An unordered map that stores data in NEAR storage.
 */
class UnorderedMap {
  /**
   * @param prefix - The byte prefix to use when storing elements inside this collection.
   */
  constructor(prefix) {
    this.prefix = prefix;
    this._keys = new Vector(`${prefix}u`); // intentional different prefix with old UnorderedMap
    this.values = new LookupMap(`${prefix}m`);
  }
  /**
   * The number of elements stored in the collection.
   */
  get length() {
    return this._keys.length;
  }
  /**
   * Checks whether the collection is empty.
   */
  isEmpty() {
    return this._keys.isEmpty();
  }
  /**
   * Get the data stored at the provided key.
   *
   * @param key - The key at which to look for the data.
   * @param options - Options for retrieving the data.
   */
  get(key, options) {
    const valueAndIndex = this.values.get(key);
    if (valueAndIndex === null) {
      return options?.defaultValue ?? null;
    }
    const [value] = valueAndIndex;
    return getValueWithOptions(encode(value), options);
  }
  /**
   * Store a new value at the provided key.
   *
   * @param key - The key at which to store in the collection.
   * @param value - The value to store in the collection.
   * @param options - Options for retrieving and storing the data.
   */
  set(key, value, options) {
    const valueAndIndex = this.values.get(key);
    const serialized = serializeValueWithOptions(value, options);
    if (valueAndIndex === null) {
      const newElementIndex = this.length;
      this._keys.push(key);
      this.values.set(key, [decode(serialized), newElementIndex]);
      return null;
    }
    const [oldValue, oldIndex] = valueAndIndex;
    this.values.set(key, [decode(serialized), oldIndex]);
    return getValueWithOptions(encode(oldValue), options);
  }
  /**
   * Removes and retrieves the element with the provided key.
   *
   * @param key - The key at which to remove data.
   * @param options - Options for retrieving the data.
   */
  remove(key, options) {
    const oldValueAndIndex = this.values.remove(key);
    if (oldValueAndIndex === null) {
      return options?.defaultValue ?? null;
    }
    const [value, index] = oldValueAndIndex;
    assert(this._keys.swapRemove(index) !== null, ERR_INCONSISTENT_STATE);
    // the last key is swapped to key[index], the corresponding [value, index] need update
    if (!this._keys.isEmpty() && index !== this._keys.length) {
      // if there is still elements and it was not the last element
      const swappedKey = this._keys.get(index);
      const swappedValueAndIndex = this.values.get(swappedKey);
      assert(swappedValueAndIndex !== null, ERR_INCONSISTENT_STATE);
      this.values.set(swappedKey, [swappedValueAndIndex[0], index]);
    }
    return getValueWithOptions(encode(value), options);
  }
  /**
   * Remove all of the elements stored within the collection.
   */
  clear() {
    for (const key of this._keys) {
      // Set instead of remove to avoid loading the value from storage.
      this.values.set(key, null);
    }
    this._keys.clear();
  }
  [Symbol.iterator]() {
    return new UnorderedMapIterator(this);
  }
  /**
   * Create a iterator on top of the default collection iterator using custom options.
   *
   * @param options - Options for retrieving and storing the data.
   */
  createIteratorWithOptions(options) {
    return {
      [Symbol.iterator]: () => new UnorderedMapIterator(this, options)
    };
  }
  /**
   * Return a JavaScript array of the data stored within the collection.
   *
   * @param options - Options for retrieving and storing the data.
   */
  toArray(options) {
    const array = [];
    const iterator = options ? this.createIteratorWithOptions(options) : this;
    for (const value of iterator) {
      array.push(value);
    }
    return array;
  }
  /**
   * Extends the current collection with the passed in array of key-value pairs.
   *
   * @param keyValuePairs - The key-value pairs to extend the collection with.
   */
  extend(keyValuePairs) {
    for (const [key, value] of keyValuePairs) {
      this.set(key, value);
    }
  }
  /**
   * Serialize the collection.
   *
   * @param options - Options for storing the data.
   */
  serialize(options) {
    return serializeValueWithOptions(this, options);
  }
  /**
   * Converts the deserialized data from storage to a JavaScript instance of the collection.
   *
   * @param data - The deserialized data to create an instance from.
   */
  static reconstruct(data) {
    const map = new UnorderedMap(data.prefix);
    // reconstruct keys Vector
    map._keys = new Vector(`${data.prefix}u`);
    map._keys.length = data._keys.length;
    // reconstruct values LookupMap
    map.values = new LookupMap(`${data.prefix}m`);
    return map;
  }
  keys({
    start,
    limit
  }) {
    const ret = [];
    if (start === undefined) {
      start = 0;
    }
    if (limit == undefined) {
      limit = this.length - start;
    }
    for (let i = start; i < start + limit; i++) {
      ret.push(this._keys.get(i));
    }
    return ret;
  }
}
/**
 * An iterator for the UnorderedMap collection.
 */
class UnorderedMapIterator {
  /**
   * @param unorderedMap - The unordered map collection to create an iterator for.
   * @param options - Options for retrieving and storing data.
   */
  constructor(unorderedMap, options) {
    this.options = options;
    this.keys = new VectorIterator(unorderedMap._keys);
    this.map = unorderedMap.values;
  }
  next() {
    const key = this.keys.next();
    if (key.done) {
      return {
        value: [key.value, null],
        done: key.done
      };
    }
    const valueAndIndex = this.map.get(key.value);
    assert(valueAndIndex !== null, ERR_INCONSISTENT_STATE);
    return {
      done: key.done,
      value: [key.value, getValueWithOptions(encode(valueAndIndex[0]), this.options)]
    };
  }
}

/**
 * Tells the SDK to use this function as the initialization function of the contract.
 *
 * @param _empty - An empty object.
 */
function initialize(_empty) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (_target, _key, _descriptor
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  ) {};
}
/**
 * Tells the SDK to expose this function as a view function.
 *
 * @param _empty - An empty object.
 */
function view(_empty) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (_target, _key, _descriptor
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  ) {};
}
function call({
  privateFunction = false,
  payableFunction = false
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (_target, _key, descriptor) {
    const originalMethod = descriptor.value;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    descriptor.value = function (...args) {
      if (privateFunction && predecessorAccountId() !== currentAccountId()) {
        throw new Error("Function is private");
      }
      if (!payableFunction && attachedDeposit() > 0n) {
        throw new Error("Function is not payable");
      }
      return originalMethod.apply(this, args);
    };
  };
}
function NearBindgen({
  requireInit = false,
  serializer = serialize,
  deserializer = deserialize
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return target => {
    return class extends target {
      static _create() {
        return new target();
      }
      static _getState() {
        const rawState = storageReadRaw(bytes("STATE"));
        return rawState ? this._deserialize(rawState) : null;
      }
      static _saveToStorage(objectToSave) {
        storageWriteRaw(bytes("STATE"), this._serialize(objectToSave));
      }
      static _getArgs() {
        return JSON.parse(input() || "{}");
      }
      static _serialize(value, forReturn = false) {
        if (forReturn) {
          return encode(JSON.stringify(value, (_, value) => typeof value === "bigint" ? `${value}` : value));
        }
        return serializer(value);
      }
      static _deserialize(value) {
        return deserializer(value);
      }
      static _reconstruct(classObject, plainObject) {
        for (const item in classObject) {
          const reconstructor = classObject[item].constructor?.reconstruct;
          classObject[item] = reconstructor ? reconstructor(plainObject[item]) : plainObject[item];
        }
        return classObject;
      }
      static _requireInit() {
        return requireInit;
      }
    };
  };
}

/**
 * ACH — multilateral netting engine (vendored into the contract).
 *
 * Same algorithm as packages/core, kept self-contained because the NEAR
 * contract must compile to a single wasm bundle with no external imports.
 */

function computeNetPositions(obligations) {
  const nets = new Map();
  for (const obl of obligations) {
    if (obl.debtor === obl.creditor) continue;
    nets.set(obl.debtor, (nets.get(obl.debtor) ?? 0n) - obl.amount);
    nets.set(obl.creditor, (nets.get(obl.creditor) ?? 0n) + obl.amount);
  }
  return [...nets.entries()].filter(([, net]) => net !== 0n).map(([accountId, net]) => ({
    accountId,
    net
  })).sort((a, b) => a.net < b.net ? -1 : a.net > b.net ? 1 : 0);
}
function minimizeTransfers(positions) {
  const debtors = positions.filter(p => p.net < 0n).map(p => ({
    accountId: p.accountId,
    remaining: -p.net
  })).sort((a, b) => a.remaining > b.remaining ? -1 : 1);
  const creditors = positions.filter(p => p.net > 0n).map(p => ({
    accountId: p.accountId,
    remaining: p.net
  })).sort((a, b) => a.remaining > b.remaining ? -1 : 1);
  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = debtor.remaining < creditor.remaining ? debtor.remaining : creditor.remaining;
    transfers.push({
      from: debtor.accountId,
      to: creditor.accountId,
      amount
    });
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0n) i++;
    if (creditor.remaining === 0n) j++;
  }
  return transfers;
}
function clearObligations(obligations) {
  const positions = computeNetPositions(obligations);
  const transfers = minimizeTransfers(positions);
  const grossVolume = obligations.reduce((acc, o) => acc + o.amount, 0n);
  const netVolume = transfers.reduce((acc, t) => acc + t.amount, 0n);
  return {
    positions,
    transfers,
    grossVolume,
    netVolume,
    compression: grossVolume > 0n ? Number(netVolume) / Number(grossVolume) : 0,
    obligationCount: obligations.length,
    obligationIds: obligations.map(o => o.id)
  };
}

var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec0, _dec1, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _dec19, _dec20, _dec21, _dec22, _class, _class2;
/**
 * Current time in milliseconds since epoch.
 *
 * NB: `Date.now()` returns 0 inside the NEAR JS VM (not implemented), so we
 * read the block timestamp instead (nanoseconds) and convert to ms. This is
 * what backs settlement timestamps, obligation createdAt, and due-date checks.
 */
function nowMs() {
  return Number(blockTimestamp() / 1000000n);
}
const MAX_MEMO_LEN = 200;
let ClearingHouse = (_dec = NearBindgen({}), _dec2 = call({}), _dec3 = initialize(), _dec4 = call({}), _dec5 = view(), _dec6 = view(), _dec7 = call({}), _dec8 = call({}), _dec9 = view(), _dec0 = view(), _dec1 = view(), _dec10 = view(), _dec11 = call({
  payableFunction: true
}), _dec12 = call({}), _dec13 = view(), _dec14 = call({}), _dec15 = call({}), _dec16 = call({}), _dec17 = view(), _dec18 = view(), _dec19 = call({}), _dec20 = view(), _dec21 = call({}), _dec22 = view(), _dec(_class = (_class2 = class ClearingHouse {
  /** Collateral ratio: a net debtor must hold balance >= ratio × net debit. */

  constructor() {
    this.ownerId = "";
    this.participants = new UnorderedMap("p");
    this.balances = new LookupMap("b");
    this.obligations = new UnorderedMap("o");
    this.settlements = new UnorderedMap("s");
    this.nextObligationId = 1;
    this.nextSettlementId = 1;
    this.totalObligations = 0;
    this.totalSettledVolume = 0n;
    this.collateralRatio = 1;
  }

  /* ---------------------------------------------------------------- */
  /* Open-obligation index (raw storage — avoids state-layout breaks)   */
  /* ---------------------------------------------------------------- */

  static OPEN_IDS_KEY = "open_ids";
  openIds() {
    const raw = storageRead(ClearingHouse.OPEN_IDS_KEY);
    if (raw === null) return this.migrateOpenIds();
    return JSON.parse(raw);
  }
  persistOpenIds(ids) {
    storageWrite(ClearingHouse.OPEN_IDS_KEY, JSON.stringify(ids));
  }

  /** One-time backfill from existing obligations (safe to re-run). */
  migrateOpenIds() {
    const ids = [];
    for (const [id, obl] of this.obligations.toArray()) {
      if (obl.status === "open") ids.push(id);
    }
    this.persistOpenIds(ids);
    return ids;
  }

  /**
   * Chunked backfill of the open-obligation index. Iterating all stored
   * obligations in one call exceeds the 300 TGas cap once history grows,
   * so we process `batch_size` per call and persist a cursor.
   */
  migrate_open_index({
    batch_size
  }) {
    const batch = Math.max(1, Math.min(batch_size ?? 50, 100));
    const cursorKey = "open_ids_cursor";
    const rawCursor = storageRead(cursorKey);
    const start = rawCursor === null ? 0 : Number(rawCursor);
    const all = this.obligations.toArray();
    const end = Math.min(start + batch, all.length);
    const rawIds = storageRead(ClearingHouse.OPEN_IDS_KEY);
    const ids = rawIds === null ? [] : JSON.parse(rawIds);
    let added = 0;
    for (let i = start; i < end; i++) {
      const [id, obl] = all[i];
      if (obl.status === "open" && !ids.includes(id)) {
        ids.push(id);
        added += 1;
      }
    }
    storageWrite(ClearingHouse.OPEN_IDS_KEY, JSON.stringify(ids));
    if (end >= all.length) {
      storageRemove(cursorKey);
      return {
        done: true,
        processed: end,
        added
      };
    }
    storageWrite(cursorKey, String(end));
    return {
      done: false,
      processed: end,
      added,
      next: end
    };
  }
  addOpenId(id) {
    const ids = this.openIds();
    if (!ids.includes(id)) {
      ids.push(id);
      this.persistOpenIds(ids);
    }
  }
  removeOpenId(id) {
    const ids = this.openIds();
    const idx = ids.indexOf(id);
    if (idx !== -1) {
      ids.splice(idx, 1);
      this.persistOpenIds(ids);
    }
  }
  init({
    owner_id
  }) {
    validateAccountId(owner_id);
    this.ownerId = owner_id;
  }

  /* ---------------------------------------------------------------- */
  /* Registration                                                      */
  /* ---------------------------------------------------------------- */

  join({
    name,
    kind,
    bio,
    icon
  }) {
    const accountId = predecessorAccountId();
    assert(this.participants.get(accountId) === null, "Already registered");
    assert(name.length >= 2 && name.length <= 40, "Name must be 2-40 chars");
    assert(kind.length >= 2 && kind.length <= 24, "Kind must be 2-24 chars");
    assert(bio.length <= 200, "Bio too long");
    assert(icon.length <= 8, "Icon too long");

    // Registration is free; the contract account pays storage.
    this.participants.set(accountId, {
      accountId,
      name,
      kind,
      bio,
      icon,
      createdAt: nowMs(),
      creditLimit: 0n
    });
    return {
      accountId
    };
  }
  get_participants() {
    return this.participants.toArray().map(([, p]) => p);
  }
  get_participant({
    account_id
  }) {
    return this.participants.get(account_id) ?? null;
  }

  /* ---------------------------------------------------------------- */
  /* Risk controls: credit limits & collateral ratio                  */
  /* ---------------------------------------------------------------- */

  set_credit_limit({
    account_id,
    limit
  }) {
    const caller = predecessorAccountId();
    assert(caller === this.ownerId, "Only the owner can set credit limits");
    const participant = this.participants.get(account_id);
    assert(participant !== null, "Participant not found");
    const limitBig = BigInt(limit);
    assert(limitBig >= 0n, "Limit must be >= 0");
    participant.creditLimit = limitBig;
    this.participants.set(account_id, participant);
    return {
      account_id,
      creditLimit: limitBig.toString()
    };
  }
  set_collateral_ratio({
    ratio
  }) {
    const caller = predecessorAccountId();
    assert(caller === this.ownerId, "Only the owner can set the collateral ratio");
    assert(Number.isFinite(ratio) && ratio >= 0 && ratio <= 10, "Ratio must be 0-10");
    this.collateralRatio = ratio;
    return {
      collateralRatio: ratio
    };
  }
  get_collateral_ratio() {
    return this.collateralRatio ?? 1;
  }
  get_credit_limits() {
    return this.participants.toArray().map(([, p]) => ({
      accountId: p.accountId,
      creditLimit: (p.creditLimit ?? 0n).toString()
    }));
  }

  /* ---------------------------------------------------------------- */
  /* Statements & risk (reconciliation)                                */
  /* ---------------------------------------------------------------- */

  participantExposure(accountId) {
    let grossPayable = 0n; // obligations where accountId owes
    let grossReceivable = 0n; // obligations where accountId is owed
    const openIncoming = [];
    const openOutgoing = [];
    for (const [, obl] of this.obligations.toArray()) {
      if (obl.status !== "open") continue;
      const dto = {
        id: obl.id,
        debtor: obl.debtor,
        creditor: obl.creditor,
        amount: obl.amount.toString(),
        memo: obl.memo,
        createdAt: obl.createdAt,
        dueAt: obl.dueAt,
        status: obl.status,
        disputedBy: obl.disputedBy
      };
      if (obl.debtor === accountId) {
        grossPayable += obl.amount;
        openOutgoing.push(dto);
      } else if (obl.creditor === accountId) {
        grossReceivable += obl.amount;
        openIncoming.push(dto);
      }
    }
    return {
      grossPayable,
      grossReceivable,
      openIncoming,
      openOutgoing
    };
  }
  get_statement({
    account_id
  }) {
    assert(this.participants.get(account_id) !== null, "Participant not found");
    const balance = this.balances.get(account_id) ?? 0n;
    const participant = this.participants.get(account_id);
    const {
      grossPayable,
      grossReceivable,
      openIncoming,
      openOutgoing
    } = this.participantExposure(account_id);
    const netPosition = grossReceivable - grossPayable;

    // Settlement history involving this participant.
    const settlements = [];
    for (const [, s] of this.settlements.toArray()) {
      const mine = s.transfers.filter(t => t.from === account_id || t.to === account_id);
      if (mine.length > 0) {
        settlements.push({
          id: s.id,
          timestamp: s.timestamp,
          netVolume: s.netVolume.toString(),
          compression: s.compression,
          transfers: mine.map(t => ({
            from: t.from,
            to: t.to,
            amount: t.amount.toString()
          }))
        });
      }
    }
    return {
      accountId: account_id,
      name: participant.name,
      kind: participant.kind,
      balance: balance.toString(),
      creditLimit: (participant.creditLimit ?? 0n).toString(),
      grossPayable: grossPayable.toString(),
      grossReceivable: grossReceivable.toString(),
      netPosition: netPosition.toString(),
      openIncoming,
      openOutgoing,
      settlements
    };
  }
  get_risk() {
    const out = [];
    for (const [, p] of this.participants.toArray()) {
      const balance = this.balances.get(p.accountId) ?? 0n;
      const {
        grossPayable,
        grossReceivable
      } = this.participantExposure(p.accountId);
      const netPosition = grossReceivable - grossPayable;
      const netDebit = netPosition < 0n ? -netPosition : 0n;
      const collateralRequired = BigInt(Math.round(Number(netDebit) * (this.collateralRatio ?? 1)));
      out.push({
        accountId: p.accountId,
        name: p.name,
        balance: balance.toString(),
        creditLimit: (p.creditLimit ?? 0n).toString(),
        grossPayable: grossPayable.toString(),
        grossReceivable: grossReceivable.toString(),
        netPosition: netPosition.toString(),
        collateralRequired: collateralRequired.toString(),
        covered: balance >= collateralRequired
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Deposits & withdrawals (settlement currency = NEAR)               */
  /* ---------------------------------------------------------------- */

  deposit() {
    const accountId = predecessorAccountId();
    assert(this.participants.get(accountId) !== null, "Not registered");
    const attached = attachedDeposit();
    assert(attached > 0n, "Attach a deposit");
    const balance = this.balances.get(accountId) ?? 0n;
    this.balances.set(accountId, balance + attached);
    return {
      accountId,
      deposited: attached.toString(),
      balance: (balance + attached).toString()
    };
  }
  withdraw({
    amount
  }) {
    const accountId = predecessorAccountId();
    const amountBig = BigInt(amount);
    assert(amountBig > 0n, "Amount must be positive");
    const balance = this.balances.get(accountId) ?? 0n;
    assert(balance >= amountBig, `Insufficient balance: have ${balance.toString()}, want ${amountBig.toString()}`);
    this.balances.set(accountId, balance - amountBig);
    const promise = promiseBatchCreate(accountId);
    promiseBatchActionTransfer(promise, amountBig);
    promiseReturn(promise);
    return {
      accountId,
      withdrawn: amountBig.toString(),
      balance: (balance - amountBig).toString()
    };
  }
  get_balance({
    account_id
  }) {
    return (this.balances.get(account_id) ?? 0n).toString();
  }

  /* ---------------------------------------------------------------- */
  /* Obligations                                                       */
  /* ---------------------------------------------------------------- */

  record_obligation({
    debtor,
    creditor,
    amount,
    memo,
    due_at
  }) {
    const caller = predecessorAccountId();
    validateAccountId(debtor);
    validateAccountId(creditor);
    assert(debtor !== creditor, "Debtor and creditor must differ");
    assert(caller === debtor || caller === creditor, "Only debtor or creditor can record");
    assert(this.participants.get(debtor) !== null, `Debtor ${debtor} not registered`);
    assert(this.participants.get(creditor) !== null, `Creditor ${creditor} not registered`);
    const amountBig = BigInt(amount);
    assert(amountBig > 0n, "Amount must be positive");
    assert(memo.length <= MAX_MEMO_LEN, `Memo too long (max ${MAX_MEMO_LEN})`);
    if (due_at !== null) {
      assert(Number.isFinite(due_at) && due_at > 0, "Invalid due_at");
    }
    const id = `obl-${this.nextObligationId}`;
    this.nextObligationId += 1;
    this.totalObligations += 1;
    this.obligations.set(id, {
      id,
      debtor,
      creditor,
      amount: amountBig,
      memo,
      createdAt: nowMs(),
      dueAt: due_at,
      status: "open"
    });
    this.addOpenId(id);
    return {
      id
    };
  }
  dispute({
    obligation_id
  }) {
    const caller = predecessorAccountId();
    const obl = this.obligations.get(obligation_id);
    assert(obl !== null, "Obligation not found");
    assert(obl.debtor === caller || obl.creditor === caller, "Only debtor or creditor can dispute");
    assert(obl.status === "open", "Only open obligations can be disputed");
    obl.status = "disputed";
    obl.disputedBy = caller;
    this.obligations.set(obligation_id, obl);
    this.removeOpenId(obligation_id);
    return {
      obligation_id,
      status: "disputed"
    };
  }
  resolve_dispute({
    obligation_id,
    outcome
  }) {
    const caller = predecessorAccountId();
    const obl = this.obligations.get(obligation_id);
    assert(obl !== null, "Obligation not found");
    assert(obl.debtor === caller || obl.creditor === caller, "Only debtor or creditor can resolve");
    assert(obl.status === "disputed", "Only disputed obligations can be resolved");
    assert(outcome === "keep" || outcome === "void", "Outcome must be keep or void");
    if (outcome === "keep") {
      obl.status = "open";
      obl.disputedBy = undefined;
      this.addOpenId(obligation_id);
    } else {
      obl.status = "voided";
    }
    this.obligations.set(obligation_id, obl);
    return {
      obligation_id,
      status: obl.status
    };
  }
  get_obligations({
    status,
    account_id,
    limit
  }) {
    const max = Math.min(limit ?? 100, 500);
    const out = [];
    for (const [, obl] of this.obligations.toArray()) {
      if (out.length >= max) break;
      if (status && obl.status !== status) continue;
      if (account_id && obl.debtor !== account_id && obl.creditor !== account_id) continue;
      out.push({
        id: obl.id,
        debtor: obl.debtor,
        creditor: obl.creditor,
        amount: obl.amount.toString(),
        memo: obl.memo,
        createdAt: obl.createdAt,
        dueAt: obl.dueAt,
        status: obl.status,
        disputedBy: obl.disputedBy
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Clearing                                                          */
  /* ---------------------------------------------------------------- */

  eligibleObligations(includeNotDue) {
    const now = nowMs();
    const out = [];
    for (const id of this.openIds()) {
      const obl = this.obligations.get(id);
      if (obl === null || obl.status !== "open") continue;
      if (obl.dueAt !== null && obl.dueAt > now && !includeNotDue) continue;
      out.push(obl);
    }
    return out;
  }
  toDTO(result) {
    return {
      positions: result.positions.map(p => ({
        accountId: p.accountId,
        net: p.net.toString()
      })),
      transfers: result.transfers.map(t => ({
        from: t.from,
        to: t.to,
        amount: t.amount.toString()
      })),
      grossVolume: result.grossVolume.toString(),
      netVolume: result.netVolume.toString(),
      compression: result.compression,
      obligationCount: result.obligationCount,
      obligationIds: result.obligationIds
    };
  }
  compute_net_positions({
    include_not_due
  }) {
    const eligible = this.eligibleObligations(include_not_due ?? false);
    const result = clearObligations(eligible.map(o => ({
      id: o.id,
      debtor: o.debtor,
      creditor: o.creditor,
      amount: o.amount
    })));
    return this.toDTO(result);
  }
  clear({
    include_not_due,
    max_obligations
  }) {
    const eligible = this.eligibleObligations(include_not_due ?? false);
    assert(eligible.length > 0, "Nothing to clear");

    // Settle in batches: the 300 TGas protocol cap bounds how many
    // obligations one call can process. The caller loops until `remaining`
    // is 0. Default batch 10 — comfortably inside the gas budget even as
    // obligation history grows.
    const max = Math.max(1, Math.min(max_obligations ?? 10, 200));
    const batch = eligible.slice(0, max);
    const result = clearObligations(batch.map(o => ({
      id: o.id,
      debtor: o.debtor,
      creditor: o.creditor,
      amount: o.amount
    })));
    // A batch can coincidentally net to zero — that is a legitimate clear
    // (the obligations cancel out; nothing moves). No assert, no expansion.

    // Risk checks before settlement — mirrors how real clearinghouses enforce
    // collateralization and credit limits before releasing funds.
    const netDebits = new Map();
    for (const t of result.transfers) {
      netDebits.set(t.from, (netDebits.get(t.from) ?? 0n) + t.amount);
    }
    const shortfalls = [];
    for (const [accountId, netDebit] of netDebits) {
      const balance = this.balances.get(accountId) ?? 0n;
      const ratio = this.collateralRatio ?? 1;
      const required = BigInt(Math.round(Number(netDebit) * ratio));
      if (balance < required) {
        shortfalls.push(`${accountId} needs ${required.toString()} collateral (ratio ${ratio}), has ${balance.toString()}`);
      }
      const participant = this.participants.get(accountId);
      if (participant && (participant.creditLimit ?? 0n) > 0n && netDebit > participant.creditLimit) {
        shortfalls.push(`${accountId} net debit ${netDebit.toString()} exceeds credit limit ${participant.creditLimit.toString()}`);
      }
    }
    assert(shortfalls.length === 0, `Risk check failed: ${shortfalls.join("; ")}`);

    // Apply transfers atomically.
    for (const t of result.transfers) {
      const fromBalance = this.balances.get(t.from) ?? 0n;
      const toBalance = this.balances.get(t.to) ?? 0n;
      this.balances.set(t.from, fromBalance - t.amount);
      this.balances.set(t.to, toBalance + t.amount);
    }

    // Mark obligations settled (iterate only the batch).
    for (const obl of batch) {
      obl.status = "settled";
      this.obligations.set(obl.id, obl);
      this.removeOpenId(obl.id);
    }

    // Record the settlement round.
    const roundId = `round-${this.nextSettlementId}`;
    this.nextSettlementId += 1;
    this.totalSettledVolume += result.netVolume;
    const record = {
      id: roundId,
      timestamp: nowMs(),
      grossVolume: result.grossVolume,
      netVolume: result.netVolume,
      compression: result.compression,
      obligationCount: result.obligationCount,
      obligationIds: result.obligationIds,
      transfers: result.transfers
    };
    this.settlements.set(roundId, record);
    return {
      roundId,
      remaining: eligible.length - batch.length,
      transfers: result.transfers.map(t => ({
        from: t.from,
        to: t.to,
        amount: t.amount.toString()
      })),
      grossVolume: result.grossVolume.toString(),
      netVolume: result.netVolume.toString(),
      compression: result.compression,
      obligationCount: result.obligationCount
    };
  }
  get_settlements({
    limit
  }) {
    const max = Math.min(limit ?? 50, 200);
    const all = [];
    for (const [, s] of this.settlements.toArray()) {
      all.push({
        id: s.id,
        timestamp: s.timestamp,
        grossVolume: s.grossVolume.toString(),
        netVolume: s.netVolume.toString(),
        compression: s.compression,
        obligationCount: s.obligationCount,
        obligationIds: s.obligationIds,
        transfers: s.transfers.map(t => ({
          from: t.from,
          to: t.to,
          amount: t.amount.toString()
        }))
      });
    }
    // Newest first — the UI shows the most recent rounds.
    return all.slice(-max).reverse();
  }

  /**
   * Maintenance: purge settled/voided/disputed obligations and old
   * settlement records to free storage. The contract pays for storage, so
   * history growth eventually starves it — this keeps it operational.
   * Only the owner may call it.
   */
  purge_history({
    keep_settlements
  }) {
    const caller = predecessorAccountId();
    assert(caller === this.ownerId, "Only the owner can purge history");

    // Purge non-open obligations.
    let purgedObligations = 0;
    for (const [id, obl] of this.obligations.toArray()) {
      if (obl.status !== "open") {
        this.obligations.remove(id);
        this.removeOpenId(id);
        purgedObligations += 1;
      }
    }

    // Keep the most recent `keep_settlements` settlement records.
    const keep = Math.max(1, Math.min(keep_settlements ?? 50, 200));
    const all = this.settlements.toArray().map(([id]) => id);
    const drop = all.length - keep;
    let purgedSettlements = 0;
    for (let i = 0; i < drop; i++) {
      this.settlements.remove(all[i]);
      purgedSettlements += 1;
    }
    return {
      purgedObligations,
      purgedSettlements
    };
  }
  get_stats() {
    return {
      ownerId: this.ownerId,
      participantCount: this.participants.length,
      obligationCount: this.totalObligations,
      openObligations: this.obligations.toArray().filter(([, o]) => o.status === "open").length,
      settlementCount: this.settlements.length,
      totalSettledVolume: this.totalSettledVolume.toString()
    };
  }
}, _applyDecoratedDescriptor(_class2.prototype, "migrate_open_index", [_dec2], Object.getOwnPropertyDescriptor(_class2.prototype, "migrate_open_index"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "init", [_dec3], Object.getOwnPropertyDescriptor(_class2.prototype, "init"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "join", [_dec4], Object.getOwnPropertyDescriptor(_class2.prototype, "join"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_participants", [_dec5], Object.getOwnPropertyDescriptor(_class2.prototype, "get_participants"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_participant", [_dec6], Object.getOwnPropertyDescriptor(_class2.prototype, "get_participant"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "set_credit_limit", [_dec7], Object.getOwnPropertyDescriptor(_class2.prototype, "set_credit_limit"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "set_collateral_ratio", [_dec8], Object.getOwnPropertyDescriptor(_class2.prototype, "set_collateral_ratio"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_collateral_ratio", [_dec9], Object.getOwnPropertyDescriptor(_class2.prototype, "get_collateral_ratio"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_credit_limits", [_dec0], Object.getOwnPropertyDescriptor(_class2.prototype, "get_credit_limits"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_statement", [_dec1], Object.getOwnPropertyDescriptor(_class2.prototype, "get_statement"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_risk", [_dec10], Object.getOwnPropertyDescriptor(_class2.prototype, "get_risk"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "deposit", [_dec11], Object.getOwnPropertyDescriptor(_class2.prototype, "deposit"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "withdraw", [_dec12], Object.getOwnPropertyDescriptor(_class2.prototype, "withdraw"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_balance", [_dec13], Object.getOwnPropertyDescriptor(_class2.prototype, "get_balance"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "record_obligation", [_dec14], Object.getOwnPropertyDescriptor(_class2.prototype, "record_obligation"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "dispute", [_dec15], Object.getOwnPropertyDescriptor(_class2.prototype, "dispute"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "resolve_dispute", [_dec16], Object.getOwnPropertyDescriptor(_class2.prototype, "resolve_dispute"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_obligations", [_dec17], Object.getOwnPropertyDescriptor(_class2.prototype, "get_obligations"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "compute_net_positions", [_dec18], Object.getOwnPropertyDescriptor(_class2.prototype, "compute_net_positions"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "clear", [_dec19], Object.getOwnPropertyDescriptor(_class2.prototype, "clear"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_settlements", [_dec20], Object.getOwnPropertyDescriptor(_class2.prototype, "get_settlements"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "purge_history", [_dec21], Object.getOwnPropertyDescriptor(_class2.prototype, "purge_history"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_stats", [_dec22], Object.getOwnPropertyDescriptor(_class2.prototype, "get_stats"), _class2.prototype), _class2)) || _class);
function get_stats() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.get_stats(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function purge_history() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.purge_history(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function get_settlements() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.get_settlements(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function clear() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.clear(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function compute_net_positions() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.compute_net_positions(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function get_obligations() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.get_obligations(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function resolve_dispute() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.resolve_dispute(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function dispute() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.dispute(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function record_obligation() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.record_obligation(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function get_balance() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.get_balance(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function withdraw() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.withdraw(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function deposit() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.deposit(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function get_risk() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.get_risk(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function get_statement() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.get_statement(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function get_credit_limits() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.get_credit_limits(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function get_collateral_ratio() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.get_collateral_ratio(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function set_collateral_ratio() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.set_collateral_ratio(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function set_credit_limit() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.set_credit_limit(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function get_participant() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.get_participant(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function get_participants() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.get_participants(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function join() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.join(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function init() {
  const _state = ClearingHouse._getState();
  if (_state) {
    throw new Error("Contract already initialized");
  }
  const _contract = ClearingHouse._create();
  const _args = ClearingHouse._getArgs();
  const _result = _contract.init(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}
function migrate_open_index() {
  const _state = ClearingHouse._getState();
  if (!_state && ClearingHouse._requireInit()) {
    throw new Error("Contract must be initialized");
  }
  const _contract = ClearingHouse._create();
  if (_state) {
    ClearingHouse._reconstruct(_contract, _state);
  }
  const _args = ClearingHouse._getArgs();
  const _result = _contract.migrate_open_index(_args);
  ClearingHouse._saveToStorage(_contract);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ClearingHouse._serialize(_result, true));
}

export { ClearingHouse, clear, compute_net_positions, deposit, dispute, get_balance, get_collateral_ratio, get_credit_limits, get_obligations, get_participant, get_participants, get_risk, get_settlements, get_statement, get_stats, init, join, migrate_open_index, purge_history, record_obligation, resolve_dispute, set_collateral_ratio, set_credit_limit, withdraw };
//# sourceMappingURL=clearing.js.map
