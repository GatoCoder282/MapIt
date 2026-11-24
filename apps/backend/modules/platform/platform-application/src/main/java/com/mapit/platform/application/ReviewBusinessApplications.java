package com.mapit.platform.application;

import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.platform.domain.BusinessApplication;
import com.mapit.platform.domain.BusinessApplicationPage;
import com.mapit.platform.domain.BusinessApplicationRepository;
import com.mapit.platform.domain.BusinessApplicationStatus;
import com.mapit.platform.domain.PlatformApplicationScope;

/** Consulta solicitudes del ámbito platform para un actor autorizado en el borde HTTP. */
@Service
public class ReviewBusinessApplications {
  private final BusinessApplicationRepository repository;
  private final PlatformApplicationScope scope;

  public ReviewBusinessApplications(BusinessApplicationRepository repository, PlatformApplicationScope scope) {
    this.repository = repository;
    this.scope = scope;
  }

  @Transactional(readOnly = true)
  public BusinessApplicationPage search(@Nullable String search, @Nullable BusinessApplicationStatus status, int page, int size) {
    scope.enter();
    return repository.search(search, status, page, size);
  }

  @Transactional(readOnly = true)
  public BusinessApplication detail(UUID id) {
    scope.enter();
    return repository.findById(id).orElseThrow(() -> new BusinessApplicationNotFound());
  }
}
