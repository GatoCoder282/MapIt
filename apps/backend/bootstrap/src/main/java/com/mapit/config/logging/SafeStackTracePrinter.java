package com.mapit.config.logging;

import java.io.IOException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

import org.springframework.boot.logging.StackTracePrinter;

/** Diagnostic types and code locations only; Throwable messages are untrusted data. */
public final class SafeStackTracePrinter implements StackTracePrinter {
  @Override
  public void printStackTrace(Throwable throwable, Appendable out) throws IOException {
    Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
    int causes = 0;
    while (throwable != null && visited.add(throwable) && causes++ < 8) {
      out.append(throwable.getClass().getName()).append("\n");
      var frames = throwable.getStackTrace();
      for (int i = 0; i < Math.min(frames.length, 20); i++) {
        var frame = frames[i];
        out.append("  at ").append(frame.getClassName()).append(".")
            .append(frame.getMethodName()).append(":")
            .append(Integer.toString(frame.getLineNumber())).append("\n");
      }
      throwable = throwable.getCause();
    }
  }
}
