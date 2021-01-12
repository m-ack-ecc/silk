package org.silkframework.runtime.resource

import scala.util.Try

/**
  * Can be added to a [[WritableResource]] and adds a flag if the underlying persistent resource, e.g. a file should be
  * deleted on garbage collection.
  * The use case is that there is no other way to know when a resource is not needed anymore, but can be definitely considered
  * as waste when it gets garbage collected.
  */
trait DeleteUnderlyingResourceOnGC extends DoSomethingOnGC { self: WritableResource =>
  /** Decide if the deletion on GC should be triggered or not. */
  def deleteOnGC: Boolean

  override def finalAction(): Unit = {
    if(deleteOnGC) {
      Try(delete())
    }
  }
}

trait DoSomethingOnGC {
  def finalAction(): Unit

  /** Is triggered on GC. */
  override def finalize(): Unit = {
    super.finalize()
    finalAction()
  }
}
