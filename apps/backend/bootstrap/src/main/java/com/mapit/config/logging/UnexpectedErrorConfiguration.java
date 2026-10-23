package com.mapit.config.logging;

import java.util.List;

import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Last resolver: controller-specific and framework status mappings get first refusal. */
@Configuration
public class UnexpectedErrorConfiguration implements WebMvcConfigurer {
  @Override
  public void extendHandlerExceptionResolvers(List<HandlerExceptionResolver> resolvers) {
    resolvers.add((request, response, handler, exception) -> {
      LoggerFactory.getLogger(UnexpectedErrorConfiguration.class).atError()
          .addKeyValue("event", "http.request.failed").setCause(exception)
          .log("Unhandled application error");
      response.setStatus(500);
      response.setContentType("application/problem+json");
      try {
        response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"Internal Server Error\",\"status\":500}");
      } catch (java.io.IOException ignored) {
        // Client already disconnected; the diagnostic event above is sufficient.
      }
      return new ModelAndView();
    });
  }
}
