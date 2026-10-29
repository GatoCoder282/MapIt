package com.mapit.payments.infrastructure;

import java.util.ArrayList;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentLedgerRepository;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Repository
public class JdbcPaymentLedgerRepository implements PaymentLedgerRepository {
  private final JdbcTemplate jdbc;
  public JdbcPaymentLedgerRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
  @Override public Page list(TenantId tenant,UUID establishmentId,Payment.@Nullable Status status,int limit,int offset){
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,tenant.value());
    String filter=" p.tenant_id=? and p.establishment_id=?"+(status==null?"":" and p.status=?");
    var args=new ArrayList<Object>();args.add(tenant.value());args.add(establishmentId);if(status!=null)args.add(status.name());
    Long total=jdbc.queryForObject("select count(*) from payment p where"+filter,Long.class,args.toArray());
    args.add(limit);args.add(offset);
    var items=jdbc.query("""
        select p.*,e.name as establishment_name,m.display_name as method_name
        from payment p join establishment e on e.tenant_id=p.tenant_id and e.id=p.establishment_id
        join merchant_payment_method m on m.tenant_id=p.tenant_id and m.id=p.method_id
        where
        """+filter+" order by p.created_at desc,p.id desc limit ? offset ?",
        (r,i)->new Entry(JdbcPaymentRepository.map(r,i),r.getString("establishment_name"),r.getString("method_name")),args.toArray());
    return new Page(items,total==null?0:total);
  }
}
