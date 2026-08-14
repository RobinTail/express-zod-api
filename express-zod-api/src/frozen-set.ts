/** @class The Set that cannot be modified. */
export class FrozenSet<T> extends Set<T> implements ReadonlySet<T> {
  public constructor(values?: Iterable<T>) {
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
}
