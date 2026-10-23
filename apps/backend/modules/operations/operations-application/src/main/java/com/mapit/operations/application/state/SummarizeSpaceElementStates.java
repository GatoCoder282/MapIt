package com.mapit.operations.application.state;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.state.SpaceElementStateSummaryRepository;
import com.mapit.shared.tenant.TenantContext;

/** Resumen agregado de estados operativos para el panel del dashboard. */
@Service
public class SummarizeSpaceElementStates {

  private final SpaceElementStateSummaryRepository repository;
  private final TenantContext tenantContext;

  public SummarizeSpaceElementStates(
      SpaceElementStateSummaryRepository repository, TenantContext tenantContext) {
    this.repository = repository;
    this.tenantContext = tenantContext;
  }

  @Transactional(readOnly = true)
  public SpaceElementStateSummaryResult execute() {
    return SpaceElementStateSummaryResult.from(repository.countByState(tenantContext.require()));
  }
}
