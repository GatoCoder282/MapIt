package com.mapit.spaces.application.layout;

import java.util.UUID;

import org.springframework.stereotype.Service;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.spaces.application.floor.FloorNotFoundException;
import com.mapit.spaces.domain.layout.FloorLayout;
import com.mapit.spaces.domain.layout.LayoutQueryRepository;

/** Caso de uso: lectura agregada del layout de una planta (HU-4.01, RN-3). */
@Service
public class GetFloorLayoutUseCase {

  private final LayoutQueryRepository layouts;
  private final TenantContext tenantContext;

  public GetFloorLayoutUseCase(LayoutQueryRepository layouts, TenantContext tenantContext) {
    this.layouts = layouts;
    this.tenantContext = tenantContext;
  }

  public FloorLayout get(UUID floorId) {
    return layouts
        .findFloorLayout(tenantContext.require(), floorId)
        .orElseThrow(() -> new FloorNotFoundException(floorId));
  }
}
