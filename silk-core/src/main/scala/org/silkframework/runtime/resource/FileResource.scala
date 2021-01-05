package org.silkframework.runtime.resource

import java.io._
import java.nio.file.{Files, StandardCopyOption}
import java.time.Instant
import org.silkframework.util.FileUtils._

/**
  * A resource on the file system.
  *
  * @param file The file
  */
case class FileResource(file: File)
    extends WritableResource
        with DeleteUnderlyingResourceOnGC {

  @volatile
  private var _deleteOnGC = false

  val name: String = file.getName

  val path: String = file.getAbsolutePath

  def exists: Boolean = file.exists()

  def size: Option[Long] = Some(file.length)

  def modificationTime = Some(Instant.ofEpochMilli(file.lastModified()))

  override def inputStream: BufferedInputStream = {
    new BufferedInputStream(new FileInputStream(file))
  }

  override def deleteOnGC: Boolean = _deleteOnGC

  def setDeleteOnGC(value: Boolean): Unit = { _deleteOnGC = value }

  /**
    * Creates an empty file, overriding any existing and creating the required directories
    */
  def createEmpty(): Unit ={
    createDirectory()
    file.createNewFile()
  }

  /**
   * Lets the caller write into an [[OutputStream]] via the write function of the resource and closes it
   * after it returns.
   * @param write A function that accepts an output stream and writes to it.
   */
  override def write(append: Boolean = false)(write: OutputStream => Unit): Unit = {
    createDirectory()
    val outputStream = new BufferedOutputStream(new FileOutputStream(file, append))
    try {
      write(outputStream)
    } finally {
      outputStream.close()
    }
  }

  /**
    * Writes a file.
    */
  override def writeFile(file: File): Unit = {
    createDirectory()
    Files.copy(file.toPath, this.file.toPath, StandardCopyOption.REPLACE_EXISTING)
  }

  /**
    * Deletes this resource.
    */
  override def delete(): Unit = file.delete()

  private def createDirectory(): Unit = {
    Option(file.getParentFile).foreach(_.safeMkdirs())
  }
}
