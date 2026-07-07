-- Visit documentation — notes-only assessments for simple visit memory

do $$ begin
  alter type assessment_type add value 'visit_note';
exception
  when duplicate_object then null;
end $$;
