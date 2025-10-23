from alembic import op
import sqlalchemy as sa

revision = '8d4e3ececba4'
down_revision = 'de76fc19b371'
branch_labels = None
depends_on = None

def upgrade():
    # すでにカラムが存在する場合はスキップ
    conn = op.get_bind()
    insp = sa.inspect(conn)
    columns = [col['name'] for col in insp.get_columns('users')]
    if 'line_user_id' not in columns:
        op.add_column('users', sa.Column('line_user_id', sa.String(), nullable=True))
        op.create_index('ix_users_line_user_id', 'users', ['line_user_id'])

def downgrade():
    op.drop_index('ix_users_line_user_id', table_name='users')
    op.drop_column('users', 'line_user_id')
