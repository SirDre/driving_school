/*  
   model/dataService.js — the data repository (Model).
   One interface, two implementations:
     • makeLiveDB(sb)        - reads views / calls RPC functions on Supabase
     • makeDisconnectedDB()  - every method throws "connect first"
   Controllers depend only on this interface, never on supabase-js directly.
   No DOM, no view concerns.
 */

// Backend used before a Supabase connection exists.
export function makeDisconnectedDB() {
  const blocked = async () => {
    throw new Error('Connect to Supabase and sign in to use customer, lesson, schedule and report operations.');
  };
  return {
    refData: blocked, listCustomers: blocked, listLessons: blocked, listToday: blocked,
    listUpcoming: blocked, listInstructors: blocked, listWorkload: blocked,
    listBalances: blocked, listMonthly: blocked, listVehicleUtil: blocked,
    listAddresses: blocked, getAddress: blocked, resolveAddress: blocked,
    addCustomer: blocked, updateCustomer: blocked, deleteCustomer: blocked,
    listStaff: blocked, addStaff: blocked, updateStaff: blocked, deleteStaff: blocked,
    bookLesson: blocked, getLesson: blocked, updateLesson: blocked,
    recordPayment: blocked, cancelLesson: blocked, deleteLesson: blocked,
  };
}

// Convenience alias used by the connection controller.
export function makeSupabaseDB(sb) { return makeLiveDB(sb); }

// Live backend over a connected supabase-js client.
export function makeLiveDB(sb) {
  const s = sb.schema('driving_school');
  const ok = (d, e) => { if (e) throw new Error(e.message || e.hint || 'Request failed'); return d; };

  const mapLessonView = r => ({
    lesson_id: r.lesson_id, date: r.lesson_date, time: (r.lesson_time || '').slice(0, 5),
    price: r.price, status: r.status, customer: r.customer_name,
    instructor: r.instructor_name || '—', vehicle: r.vehicle_details || '—',
    notes: r.other_lesson_details, status_code: null, cust: null, staff: null, veh: null,
  });

  return {
    async refData() {

      const cs = await s.from('ref_customer_status').select('*');
      const ls = await s.from('ref_lesson_status').select('*');
      const pm = await s.from('ref_payment_methods').select('*');
      const st = await s.from('staff').select('staff_id,first_name,last_name,date_left_staff,other_staff_details');
      const vh = await s.from('vehicles').select('*');
      const cu = await s.from('customers').select('customer_id,first_name,last_name,customer_status_code');
      
      const m = (rows, k, v) => Object.fromEntries(ok(rows.data, rows.error).map(r => [r[k], r[v]]));
      
      return {
        custStatus: m(cs, 'customer_status_code', 'customer_status_description'),
        lessStatus: m(ls, 'lesson_status_code', 'lesson_status_description'),
        methods: m(pm, 'payment_method_code', 'payment_method_description'),
        staff: ok(st.data).map(r => ({ id: r.staff_id, first: r.first_name, last: r.last_name, left: r.date_left_staff, notes: r.other_staff_details || '' })),
        vehicles: ok(vh.data).map(r => ({ id: r.vehicle_id, details: r.vehicle_details })),
        customers: ok(cu.data).map(r => ({ id: r.customer_id, name: `${r.first_name} ${r.last_name}`, status: r.customer_status_code })),
      };
    },

    async listCustomers() {
      const { data, error } = await s.from('vw_customer_full_address').select('*');
      
      const bal = await this.listBalances();
      const bmap = Object.fromEntries(bal.map(b => [b.customer_id, b.stored_outstanding]));
      const base = await s.from('customers').select('*');
      const bm = Object.fromEntries(ok(base.data, base.error).map(r => [r.customer_id, r]));
      
      return ok(data, error).map(r => ({
        ...r, balance: bmap[r.customer_id] ?? 0,
        status_code: bm[r.customer_id]?.customer_status_code,
        first: bm[r.customer_id]?.first_name, last: bm[r.customer_id]?.last_name,
        dob: bm[r.customer_id]?.date_of_birth, since: bm[r.customer_id]?.date_became_customer,
        addr: bm[r.customer_id]?.customer_address_id,
        cell: r.cell_mobile_phone_number, email: r.email_address,
      }));
    },

    async listLessons() {
      const { data, error } = await s.from('vw_lesson_details').select('*').order('lesson_date', { ascending: false });
      
      return ok(data, error).map(r => ({
        lesson_id: r.lesson_id, date: r.lesson_date, time: (r.lesson_time || '').slice(0, 5),
        price: r.price, status: r.status, customer: r.customer_name,
        instructor: r.instructor_name || '—', vehicle: r.vehicle_details || '—',
        notes: r.other_lesson_details, status_code: null, cust: null, staff: null, veh: null,
      }));
    },

    async listToday()    { const { data, error } = await s.from('vw_today_lessons').select('*'); return ok(data, error).map(mapLessonView); },
    async listUpcoming() { const { data, error } = await s.from('vw_upcoming_lessons').select('*'); return ok(data, error).map(mapLessonView); },

    async listInstructors() {
      const { data, error } = await s.from('vw_active_instructors').select('*');
      return ok(data, error).map(r => ({ staff_id: r.staff_id, name: r.instructor_name, age: r.age, notes: r.other_staff_details || '' }));
    },

    async listStaff() { const { data, error } = await s.from('staff').select('*').order('staff_id'); return ok(data, error); },

    async listWorkload() {
      const { data, error } = await s.from('vw_instructor_workload').select('*');
      
      return ok(data, error).map(r => ({
        staff_id: r.staff_id, name: r.instructor_name, total: r.total_lessons,
        completed: r.completed_lessons, cancelled: r.cancelled_lessons, revenue: r.revenue_generated,
      })).filter(w => w.total > 0);
    },

    async listBalances() {
      const { data, error } = await s.from('vw_customer_balance').select('*');
      
      return ok(data, error).map(r => ({
        customer_id: r.customer_id, customer_name: r.customer_name, total_charged: r.total_charged,
        total_paid: r.total_paid, calculated_outstanding: r.calculated_outstanding, stored_outstanding: r.stored_outstanding,
      }));
    },

    async listMonthly()      { const { data, error } = await s.from('vw_monthly_revenue').select('*').order('pay_month'); return ok(data, error); },
    async listVehicleUtil()  { const { data, error } = await s.from('vw_vehicle_utilisation').select('*').order('lessons_completed', { ascending: false }); return ok(data, error); },

    // --- Addresses (searchable picker + find-or-create resolver) ---
    async listAddresses() { const { data, error } = await s.from('addresses').select('*').order('address_id'); return ok(data, error); },
    async getAddress(id)  { if (!id) return null; const { data, error } = await s.from('addresses').select('*').eq('address_id', id).maybeSingle(); return ok(data, error); },
    async resolveAddress(a) {
      const { data, error } = await s.rpc('fn_resolve_address', {
        p_line1: a.line_1_number_building || null, p_line2: a.line_2_number_street || null,
        p_line3: a.line_3_area_locality || null, p_city: a.city || null, p_postcode: a.zip_postcode || null,
        p_province: a.state_province_county || null, p_country: a.country || null,
      });
      return ok(data, error);
    },

    // --- Customers ---
    async addCustomer(r) {
      const { data, error } = await s.rpc('fn_add_customer', {
        p_address_id: r.addr ? +r.addr : null, p_status_code: r.status, p_date_became: r.since,
        p_date_of_birth: r.dob, p_first_name: r.first, p_last_name: r.last, p_email: r.email || null, p_cell: r.cell || null,
      });
      return ok(data, error);
    },
    async updateCustomer(id, r) {
      const { data, error } = await s.rpc('fn_update_customer', {
        p_customer_id: +id, p_address_id: r.addr ? +r.addr : null, p_status_code: r.status, p_date_became: r.since,
        p_date_of_birth: r.dob, p_first_name: r.first, p_last_name: r.last, p_email: r.email || null, p_cell: r.cell || null,
      });
      ok(data, error); return true;
    },
    async deleteCustomer(id) {
      const { error } = await s.rpc('fn_delete_customer', { p_customer_id: +id });
      if (error) {
        if (/foreign key|violates/i.test(error.message)) throw new Error('Blocked: this customer has lessons on record (RESTRICT).');
        throw new Error(error.message);
      }
      return true;
    },

    // --- Staff / instructors ---
    async addStaff(r) {
      const { data, error } = await s.rpc('fn_add_staff', {
        p_staff_address_id: r.staffAddressId ? +r.staffAddressId : null, p_status_code: r.status,
        p_nickname: r.nickname || null, p_first_name: r.first, p_middle_name: r.middle || null, p_last_name: r.last,
        p_date_of_birth: r.dob || null, p_date_joined_staff: r.joined, p_date_left_staff: r.left || null, p_other_staff_details: r.notes || null,
      });
      return ok(data, error);
    },
    async updateStaff(id, r) {
      const { data, error } = await s.rpc('fn_update_staff', {
        p_staff_id: +id, p_staff_address_id: r.staffAddressId ? +r.staffAddressId : null, p_status_code: r.status,
        p_nickname: r.nickname || null, p_first_name: r.first, p_middle_name: r.middle || null, p_last_name: r.last,
        p_date_of_birth: r.dob || null, p_date_joined_staff: r.joined, p_date_left_staff: r.left || null, p_other_staff_details: r.notes || null,
      });
      ok(data, error); return true;
    },
    async deleteStaff(id) {
      const { error } = await s.rpc('fn_delete_staff', { p_staff_id: +id });
      if (error) {
        if (/foreign key|violates/i.test(error.message)) throw new Error('Blocked: this instructor is referenced by lessons/tests.');
        throw new Error(error.message);
      }
      return true;
    },

    // --- Lessons & payments (write through stored-procedure wrappers) ---
    async bookLesson(p) {
      const { error } = await sb.schema('driving_school').rpc('fn_book_lesson', {
        p_customer_id: +p.cust, p_staff_id: p.staff ? +p.staff : null, p_vehicle_id: p.veh ? +p.veh : null,
        p_date: p.date, p_time: p.time, p_price: +p.price,
      });
      ok(null, error); return true;
    },
    async getLesson(id) {
      const { data, error } = await s.from('lessons').select('*').eq('lesson_id', +id).single();
      const r = ok(data, error);
      return {
        lesson_id: r.lesson_id,
        cust: r.customer_id,
        staff: r.staff_id,
        veh: r.vehicle_id,
        date: r.lesson_date,
        time: (r.lesson_time || '').slice(0, 5),
        price: r.price,
        notes: r.other_lesson_details || '',
        status_code: r.lesson_status_code,
      };
    },
    async updateLesson(id, p) {
      const patch = {
        customer_id: +p.cust,
        staff_id: p.staff ? +p.staff : null,
        vehicle_id: p.veh ? +p.veh : null,
        lesson_date: p.date,
        lesson_time: p.time,
        price: +p.price,
        other_lesson_details: p.notes || null,
      };
      if (p.status_code) patch.lesson_status_code = p.status_code;

      const { error } = await s.from('lessons').update(patch).eq('lesson_id', +id);
      ok(null, error); return true;
    },
    async recordPayment(p) {
      const { error } = await sb.schema('driving_school').rpc('fn_record_payment', {
        p_customer_id: +p.cust, p_method: p.method, p_amount: +p.amt, p_details: p.notes || null,
      });
      ok(null, error); return true;
    },
    async cancelLesson(id) { const { error } = await sb.schema('driving_school').rpc('fn_cancel_lesson', { p_lesson_id: id }); ok(null, error); return 'done'; },
    async deleteLesson(id) { const { error } = await sb.schema('driving_school').rpc('fn_delete_lesson', { p_lesson_id: +id }); ok(null, error); return true; },
  };
}