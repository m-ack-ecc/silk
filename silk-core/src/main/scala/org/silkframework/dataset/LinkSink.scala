package org.silkframework.dataset

import org.silkframework.config.Prefixes
import org.silkframework.entity.Link
import org.silkframework.runtime.activity.UserContext

/**
 * A sink that only writes entity links.
 */
trait LinkSink extends DataSink {
  /**
   * Initialize the link sink
   */
  def init()(implicit userContext: UserContext, prefixes: Prefixes): Unit

  /**
   * Writes a new link to this writer.
   */
  def writeLink(link: Link, predicateUri: String)(implicit userContext: UserContext, prefixes: Prefixes): Unit

  /**
   * Writes a set of links.
   */
  def writeLinks(links: Traversable[Link], predicateUri: String)
                (implicit userContext: UserContext, prefixes: Prefixes): Unit = {
    init()
    for (link <- links) writeLink(link, predicateUri)
    close()
  }
}
