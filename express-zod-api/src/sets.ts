export type SetValue<S extends Set<unknown>> =
  S extends Set<infer V> ? V : never;

const frozenSetBrand: unique symbol = Symbol("FrozenSet");

/**
 * @class The Set that cannot be modified at runtime.
 * @desc Use it for the values stored once internally and handed out through getters declared as `ReadonlySet`.
 *       Use `Set` for mutable accumulators. A nominal brand makes `Set` unassignable to `FrozenSet` at the type
 *       level, while the immutability is enforced at runtime by the mutation methods throwing `TypeError`.
 * */
export class FrozenSet<T> extends Set<T> implements ReadonlySet<T> {
  declare readonly [frozenSetBrand]: true;
  public constructor(values?: Iterable<T> | null) {
    super(); // because super(values) populates using this.add(value)
    if (values) for (const value of values) Set.prototype.add.call(this, value);
  }

  /** @throws TypeError */
  public override add(_value: T): this {
    throw new TypeError("Can not add to the read only Set");
  }

  /** @throws TypeError */
  public override delete(_value: T): boolean {
    throw new TypeError("Can not delete from the read only Set");
  }

  /** @throws TypeError */
  public override clear(): void {
    throw new TypeError("Can not clear the read only Set");
  }

  /** @desc The derived set is frozen as well. */
  public override union<U>(other: ReadonlySetLike<U>): FrozenSet<T | U> {
    return new FrozenSet(super.union(other));
  }

  /** @desc The derived set is frozen as well. */
  public override intersection<U>(other: ReadonlySetLike<U>): FrozenSet<T & U> {
    return new FrozenSet(super.intersection(other));
  }

  /** @desc The derived set is frozen as well. */
  public override difference<U>(other: ReadonlySetLike<U>): FrozenSet<T> {
    return new FrozenSet(super.difference(other));
  }

  /** @desc The derived set is frozen as well. */
  public override symmetricDifference<U>(
    other: ReadonlySetLike<U>,
  ): FrozenSet<T | U> {
    return new FrozenSet(super.symmetricDifference(other));
  }
}
