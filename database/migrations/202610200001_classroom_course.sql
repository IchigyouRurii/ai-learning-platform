alter table classrooms add column course_id text references courses(id);

-- Backfill only when the teacher has exactly one published cohort course, so we
-- never guess which course an existing class belongs to.
update classrooms c
set course_id = (
  select co.id from courses co
  where co.owner_id = c.teacher_id
    and co.status = 'published'
    and co.visibility = 'cohort'
)
where c.course_id is null
  and (
    select count(*) from courses co
    where co.owner_id = c.teacher_id
      and co.status = 'published'
      and co.visibility = 'cohort'
  ) = 1;

do $$
begin
  if exists (select 1 from classrooms where course_id is null) then
    raise exception '存在无法自动绑定课程的班级，请先手动指定课程再执行迁移。';
  end if;
end $$;

alter table classrooms alter column course_id set not null;
create index classrooms_course_idx on classrooms(course_id);
