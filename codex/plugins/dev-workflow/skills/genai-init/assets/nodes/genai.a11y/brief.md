# Check the accessibility of what this change renders

**Include this step when** the diff touches any file that renders a user-visible surface. That is a
fact you can check against the diff, not a judgement about whether something counts as a UI change.

The surface has to be running. A read of the components is not a scan, and presenting one as a scan
result is worse than reporting that you could not reach the surface.

A clean scanner run is not an accessible page. The criteria automation could not evaluate are the
reason a person reads this report at all.
