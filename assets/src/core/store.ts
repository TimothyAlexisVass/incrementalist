export class Store<T> {
  public dirty: boolean = false;

  constructor(public readonly state: T) {}

  public markDirty() {
    this.dirty = true;
  }
}
