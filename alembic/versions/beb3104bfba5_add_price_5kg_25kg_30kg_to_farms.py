"""add price_5kg_25kg_30kg_to_farms"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'  # 自動生成されたIDに置き換えてOK
down_revision = 'edded43abf4d'  # ← 直前のファイル名に合わせて修正
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('farms', schema=None) as batch_op:
        # 新しい価格カラムを追加（NULL可 → 既存データ対応）
        batch_op.add_column(sa.Column('price_5kg', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('price_25kg', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('price_30kg', sa.Float(), nullable=True))

def downgrade():
    with op.batch_alter_table('farms', schema=None) as batch_op:
        batch_op.drop_column('price_30kg')
        batch_op.drop_column('price_25kg')
        batch_op.drop_column('price_5kg')
