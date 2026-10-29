package com.mapit.spaces.infrastructure.establishment;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;
import com.mapit.spaces.domain.establishment.EstablishmentAccessRepository;

/** Política común para HTTP, selector y STOMP; nunca confía en cookies ni en un rol enviado por cliente. */
@Repository
public class JdbcEstablishmentAccessRepository implements EstablishmentAccessRepository, EstablishmentAuthorizationPort {
  private final JdbcTemplate jdbc;
  public JdbcEstablishmentAccessRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
  @Override @Transactional(readOnly=true)
  public boolean canManagePayments(TenantId tenant,UUID actor,UUID establishment){return permitted(tenant,actor,establishment,"u.role='ADMIN'");}
  @Override @Transactional(readOnly=true)
  public boolean canCheckIn(TenantId tenant,UUID actor,UUID establishment){return permitted(tenant,actor,establishment,"(u.role='ADMIN' or (u.role='STAFF' and a.can_check_in))");}
  @Override @Transactional(readOnly=true)
  public boolean canReadOperations(TenantId tenant,UUID actor,UUID establishment){return permitted(tenant,actor,establishment,"(u.role in ('ADMIN','MANAGER') or (u.role='STAFF' and a.can_check_in))");}
  private boolean permitted(TenantId tenant,UUID actor,UUID establishment,String predicate){
    scope(tenant);
    return Boolean.TRUE.equals(jdbc.queryForObject("""
        select exists(select 1 from establishment e
          join tenant t on t.id=e.tenant_id and t.status='ACTIVE'
          join app_user u on u.tenant_id=e.tenant_id and u.id=? and u.active
          left join establishment_staff_access a on a.tenant_id=e.tenant_id and a.establishment_id=e.id and a.user_id=u.id
          where e.tenant_id=? and e.id=? and e.deleted_at is null and
        """+predicate+")",Boolean.class,actor,tenant.value(),establishment));
  }
  @Override public List<AccessibleEstablishment> accessible(TenantId tenant,UUID actor){
    scope(tenant);
    return jdbc.query("""
        select e.id,e.name,e.slug,e.address,e.timezone,u.role from establishment e
        join tenant t on t.id=e.tenant_id and t.status='ACTIVE'
        join app_user u on u.tenant_id=e.tenant_id and u.id=? and u.active
        left join establishment_staff_access a on a.tenant_id=e.tenant_id and a.establishment_id=e.id and a.user_id=u.id
        where e.tenant_id=? and e.deleted_at is null
          and (u.role in ('ADMIN','MANAGER') or (u.role='STAFF' and a.can_check_in))
        order by e.name,e.id
        """,(r,i)->new AccessibleEstablishment(r.getObject("id",UUID.class),r.getString("name"),r.getString("slug"),r.getString("address"),r.getString("timezone"),
          r.getString("role").equals("ADMIN"),!r.getString("role").equals("MANAGER")),actor,tenant.value());
  }
  @Override public List<StaffAccess> staff(TenantId tenant,UUID establishment){
    scope(tenant);
    return jdbc.query("""
        select u.id,u.full_name,u.email,coalesce(a.can_check_in,false) as can_check_in from app_user u
        left join establishment_staff_access a on a.tenant_id=u.tenant_id and a.user_id=u.id and a.establishment_id=?
        where u.tenant_id=? and u.active and u.role='STAFF' order by u.full_name,u.id
        """,(r,i)->new StaffAccess(r.getObject("id",UUID.class),r.getString("full_name"),r.getString("email"),r.getBoolean("can_check_in")),establishment,tenant.value());
  }
  @Override public Optional<StaffAccess> activeStaff(TenantId tenant,UUID user){
    scope(tenant);
    return jdbc.query("select id,full_name,email from app_user where tenant_id=? and id=? and active and role='STAFF'",
        (r,i)->new StaffAccess(r.getObject("id",UUID.class),r.getString("full_name"),r.getString("email"),false),tenant.value(),user).stream().findFirst();
  }
  @Override public void save(TenantId tenant,UUID establishment,UUID user,boolean canCheckIn,UUID actor,Instant now){
    scope(tenant);
    jdbc.update("""
        insert into establishment_staff_access(tenant_id,establishment_id,user_id,can_check_in,updated_at,updated_by)
        values(?,?,?,?,?,?) on conflict(tenant_id,establishment_id,user_id) do update
        set can_check_in=excluded.can_check_in,updated_at=excluded.updated_at,updated_by=excluded.updated_by
        """,tenant.value(),establishment,user,canCheckIn,Timestamp.from(now),actor);
  }
  private void scope(TenantId tenant){jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,tenant.value());}
}
