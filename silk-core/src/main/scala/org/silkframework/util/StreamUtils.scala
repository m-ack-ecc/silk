package org.silkframework.util

import java.io.{IOException, InputStream, OutputStream}
import java.nio.{Buffer, ByteBuffer}
import java.nio.channels.{ReadableByteChannel, WritableByteChannel}
import java.nio.channels.Channels

/**
  * Utility methods for I/O stream handling.
  */
object StreamUtils {

  @throws[IOException]
  def fastChannelCopy(src: ReadableByteChannel, dest: WritableByteChannel): Unit = {
    val buffer = ByteBuffer.allocateDirect(16 * 1024)
    while (src.read(buffer) != -1) { // prepare the buffer to be drained
      // Casting to Buffer to avoid conflict mentioned here: https://stackoverflow.com/questions/61267495/exception-in-thread-main-java-lang-nosuchmethoderror-java-nio-bytebuffer-flip
      buffer.asInstanceOf[Buffer].flip()
      // write to the channel, may block
      dest.write(buffer)
      // If partial transfer, shift remainder down
      // If buffer is empty, same as doing clear()
      buffer.compact
    }
    // EOF will leave buffer in fill state
    // Casting to Buffer to avoid conflict mentioned here: https://stackoverflow.com/questions/61267495/exception-in-thread-main-java-lang-nosuchmethoderror-java-nio-bytebuffer-flip
    buffer.asInstanceOf[Buffer].flip()
    // make sure the buffer is fully drained.
    while (buffer.hasRemaining) {
      dest.write(buffer)
    }
  }

  def fastStreamCopy(input: InputStream, output: OutputStream, close: Boolean): Unit = {
    // get an channel from the stream
    val inputChannel = Channels.newChannel(input)
    val outputChannel = Channels.newChannel(output)
    // copy the channels
    fastChannelCopy(inputChannel, outputChannel)
    if(close) {
      // closing the channels
      inputChannel.close()
      outputChannel.close()
    }
  }
}
