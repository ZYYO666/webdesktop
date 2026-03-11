<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
      <div class="max-w-[880px] mx-auto space-y-6 md:space-y-8">
        <div class="flex items-center justify-between">
          <h2 class="text-base md:text-lg font-semibold text-gray-900">{{ `用户管理` }}</h2>
          <n-button type="primary" @click="showAddModal = true">
            <template #icon>
              <Plus :size="16" />
            </template>
            {{ `添加用户` }}
          </n-button>
        </div>
        
        <p class="text-sm text-gray-600 leading-relaxed">
          {{ `管理系统用户，创建新账号或修改现有账号权限。` }}
        </p>
        
        <!-- User List -->
        <div v-if="users.length > 0" class="space-y-4">
          <n-card v-for="user in users" :key="user.id" size="small" hoverable>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 overflow-hidden mr-4">
                <span class="font-bold text-gray-900">{{ user.username }}</span>
                <n-tag 
                  size="small" 
                  :type="user.role === 'admin' ? 'error' : 'info'" 
                  round 
                  :bordered="false"
                >
                  {{ user.role }}
                </n-tag>
                <span class="text-xs text-gray-400">{{ `创建时间` }}: {{ new Date(user.created_at).toLocaleDateString() }}</span>
              </div>
              <div class="flex gap-2">
                <n-button 
                  size="small" 
                  quaternary 
                  circle 
                  @click="handleEditUser(user)"
                  :disabled="user.username === 'admin' && user.id === 1"
                >
                  <template #icon><Edit2 :size="16" /></template>
                </n-button>
                <n-button 
                  size="small" 
                  quaternary 
                  circle 
                  type='error' 
                  @click="handleDeleteUser(user.id)"
                  :disabled="user.username === 'admin'"
                >
                  <template #icon><Trash2 :size="16" /></template>
                </n-button>
              </div>
            </div>
          </n-card>
        </div>
        <div v-else class="text-center py-12">
          <n-empty :description="`暂无用户`" />
        </div>
      </div>
    </div>

    <!-- Add User Modal -->
    <n-modal v-model:show="showAddModal" preset="card" :title="`添加新用户`" class="max-w-md" :bordered="false">
      <n-form
        ref="addFormRef"
        :model="newUser"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <n-form-item :label="`用户名`" path="username">
          <n-input v-model:value="newUser.username" :placeholder="`用户名`" />
        </n-form-item>
        <n-form-item :label="`密码`" path="password">
          <n-input v-model:value="newUser.password" type="password" :placeholder="`密码`" show-password-on="click" />
        </n-form-item>
        <n-form-item :label="`角色`" path="role">
          <n-radio-group v-model:value="newUser.role">
            <n-radio-button value="admin">{{ `管理员` }}</n-radio-button>
            <n-radio-button value="user">{{ `普通用户` }}</n-radio-button>
          </n-radio-group>
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="flex justify-end gap-3">
          <n-button @click="showAddModal = false">{{ `取消` }}</n-button>
          <n-button 
            type="primary" 
            :loading="addingUser" 
            @click="handleAddUser"
            :disabled="!newUser.username || !newUser.password"
          >
            {{ addingUser ? `保存中...` : `添加用户` }}
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- Edit User Modal -->
    <n-modal v-model:show="showEditModal" preset="card" :title="`编辑用户`" class="max-w-md" :bordered="false">
      <n-form
        ref="editFormRef"
        :model="editForm"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <n-form-item :label="`新密码（留空保持不变）`" path="password">
          <n-input v-model:value="editForm.password" type="password" :placeholder="`新密码（留空保持不变）`" show-password-on="click" />
        </n-form-item>
        <n-form-item :label="`角色`" path="role">
          <n-select 
            v-model:value="editForm.role" 
            :options="roleOptions" 
            :disabled="editForm.username === 'admin'"
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="flex justify-end gap-3">
          <n-button @click="showEditModal = false">{{ `取消` }}</n-button>
          <n-button type="primary" @click="saveUserEdit">
            {{ `保存更改` }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue';
import { Plus, Trash2, Edit2 } from 'lucide-vue-next';
import { useOs } from '@/os';

const os = useOs();
const api = os.api;
const toast = os.ui.toast;
const dialog = os.ui.dialog;

const addingUser = ref(false);
const users = ref([]);
const newUser = reactive({
  username: '',
  password: '',
  role: 'user'
});

const editingUser = ref(null);
const editForm = reactive({
    id: null,
    username: '',
    password: '',
    role: 'user'
});
const showEditModal = ref(false);
const showAddModal = ref(false);

const roleOptions = computed(() => [
  { label: `普通用户`, value: 'user' },
  { label: `管理员`, value: 'admin' }
]);

const fetchUsers = async () => {
  try {
    const data = await api.getUsers();
    users.value = Array.isArray(data) ? data : [];
  } catch (e) {
    toast?.error?.(e?.message || '获取用户列表失败');
    users.value = [];
  }
};

onMounted(() => {
  fetchUsers();
});

const handleAddUser = async () => {
  if (!newUser.username || !newUser.password) return;
  
  addingUser.value = true;
  try {
    await api.addUser(newUser.username, newUser.password, newUser.role);
    toast?.success?.('添加用户成功');
    await fetchUsers();
    newUser.username = '';
    newUser.password = '';
    newUser.role = 'user';
    showAddModal.value = false;
  } catch (e) {
    toast?.error?.(e?.message || '添加用户失败');
  } finally {
    addingUser.value = false;
  }
};

const handleDeleteUser = async (id) => {
  const ok = await dialog?.confirm?.('确定要删除此用户吗？');
  if (!ok) return;
  try {
    await api.deleteUser(id);
    toast?.success?.('用户删除成功');
    await fetchUsers();
  } catch (e) {
    toast?.error?.(e?.message || '删除用户失败');
  }
};

const handleEditUser = (user) => {
    editingUser.value = user;
    editForm.id = user.id;
    editForm.username = user.username;
    editForm.password = ''; // Don't show current password
    editForm.role = user.role;
    showEditModal.value = true;
};

const saveUserEdit = async () => {
    const updates = {};
    if (editForm.password) updates.password = editForm.password;
    if (editForm.role !== editingUser.value.role) updates.role = editForm.role;

    if (Object.keys(updates).length === 0) {
        showEditModal.value = false;
        return;
    }

    try {
      await api.updateUser(editForm.id, updates);
      toast?.success?.('用户更新成功');
      await fetchUsers();
      showEditModal.value = false;
    } catch (e) {
      toast?.error?.(e?.message || '用户更新失败');
    }
};
</script>
