<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
      <div class="max-w-[880px] mx-auto space-y-6 md:space-y-8">
        <div class="flex items-center justify-between">
          <h2 class="text-base md:text-lg font-semibold text-gray-900">{{ '挂载管理' }}</h2>
          <n-button type="primary" @click="showAddModal = true">
            <template #icon>
              <Plus :size="16" />
            </template>
            {{ '添加挂载' }}
          </n-button>
        </div>
        
        <p class="text-sm text-gray-600 leading-relaxed">
          {{ '管理系统挂载点，创建新挂载或修改现有挂载。' }}
        </p>

        <!-- Mount List -->
        <div v-if="mounts.length > 0" class="space-y-4">
          <n-card v-for="mount in mounts" :key="mount.id" size="small" hoverable>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 overflow-hidden mr-4">
                <n-tag :bordered="false" type='info' size="small" class="font-mono">
                  {{ mount.mountPoint }}
                </n-tag>
                <span class="text-gray-400">→</span>
                <span class="text-sm text-gray-700 truncate" :title="mount.displayLocalPath || mount.localPath">
                  {{ mount.displayLocalPath || mount.localPath }}
                </span>
              </div>
              <div class="flex gap-2">
                <n-button size="small" quaternary circle @click="handleEditMount(mount)">
                  <template #icon><Edit2 :size="16" /></template>
                </n-button>
                <n-button size="small" quaternary circle type='error' @click="handleDeleteMount(mount.id)">
                  <template #icon><Trash2 :size="16" /></template>
                </n-button>
              </div>
            </div>
          </n-card>
        </div>
        <div v-else class="text-center py-12">
           <n-empty :description="'暂无挂载点'" />
        </div>
      </div>
    </div>

    <!-- Add Mount Modal -->
    <n-modal v-model:show="showAddModal" preset="card" :title="'添加新挂载'" class="max-w-lg" :bordered="false">
      <n-form
        ref="addFormRef"
        :model="newMount"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <n-form-item :label="'挂载点'" path="mountPoint">
          <n-input v-model:value="newMount.mountPoint" placeholder="/data" />
          <template #feedback>{{ '虚拟文件系统中的路径' }}</template>
        </n-form-item>
        
        <n-form-item :label="'类型'" path='type'>
          <n-select v-model:value="newMount.type" :options="typeOptions" />
        </n-form-item>

        <n-form-item v-if="newMount.type === 'local'" :label="'本地路径'" path="localPath">
          <n-input v-model:value="newMount.localPath" placeholder="/Users/name/Photos" />
          <template #feedback>{{ '服务器上的绝对路径' }}</template>
        </n-form-item>

        <template v-if="newMount.type === 'webdav'">
          <n-card embedded class="mb-4">
            <n-form-item :label="'URL 地址'" path="config.url">
              <n-input v-model:value="newMount.config.url" placeholder="http://localhost:5244/dav/ali_root" />
            </n-form-item>
            <n-form-item :label="'用户名'" path="config.username">
              <n-input v-model:value="newMount.config.username" placeholder="admin" />
            </n-form-item>
            <n-form-item :label="'密码'" path="config.password">
              <n-input v-model:value="newMount.config.password" type="password" placeholder="******" show-password-on="click" />
            </n-form-item>
          </n-card>
        </template>

        <template v-if="newMount.type === 'smb'">
           <n-card embedded class="mb-4">
            <n-form-item :label="'主机地址'" path="config.host">
              <n-input v-model:value="newMount.config.host" placeholder="192.168.1.100" />
            </n-form-item>
            <n-form-item :label="'共享名'" path="config.share">
              <n-input v-model:value="newMount.config.share" placeholder="Public" />
            </n-form-item>
            <n-form-item :label="'域'" path="config.domain">
              <n-input v-model:value="newMount.config.domain" placeholder="WORKGROUP" />
            </n-form-item>
            <n-form-item :label="'用户名'" path="config.username">
              <n-input v-model:value="newMount.config.username" placeholder="admin" />
            </n-form-item>
            <n-form-item :label="'密码'" path="config.password">
              <n-input v-model:value="newMount.config.password" type="password" placeholder="******" show-password-on="click" />
            </n-form-item>
           </n-card>
        </template>

      </n-form>

      <template #footer>
        <div class="flex justify-end gap-3">
          <n-button @click="showAddModal = false">{{ `取消` }}</n-button>
          <n-button type="primary" @click="handleAddMount" :loading="addingMount">
            {{ addingMount ? `保存中...` : '添加挂载' }}
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- Edit Mount Modal -->
    <n-modal v-model:show="showEditModal" preset="card" :title="'编辑挂载'" class="max-w-lg" :bordered="false">
       <n-form
        ref="editFormRef"
        :model="editForm"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <n-form-item :label="'挂载点'" path="mountPoint">
          <n-input v-model:value="editForm.mountPoint" placeholder="/data" />
        </n-form-item>
        
        <n-form-item :label="'类型'" path='type'>
          <n-select v-model:value="editForm.type" :options="typeOptions" />
        </n-form-item>

        <n-form-item v-if="editForm.type === 'local'" :label="'本地路径'" path="localPath">
          <n-input v-model:value="editForm.localPath" placeholder="/Users/name/Photos" />
        </n-form-item>

        <template v-if="editForm.type === 'webdav'">
          <n-card embedded class="mb-4">
            <n-form-item :label="'URL 地址'" path="config.url">
              <n-input v-model:value="editForm.config.url" />
            </n-form-item>
            <n-form-item :label="'用户名'" path="config.username">
              <n-input v-model:value="editForm.config.username" />
            </n-form-item>
            <n-form-item :label="'密码'" path="config.password">
              <n-input v-model:value="editForm.config.password" type="password" show-password-on="click" />
            </n-form-item>
          </n-card>
        </template>

        <template v-if="editForm.type === 'smb'">
           <n-card embedded class="mb-4">
            <n-form-item :label="'主机地址'" path="config.host">
              <n-input v-model:value="editForm.config.host" />
            </n-form-item>
            <n-form-item :label="'共享名'" path="config.share">
              <n-input v-model:value="editForm.config.share" />
            </n-form-item>
            <n-form-item :label="'域'" path="config.domain">
              <n-input v-model:value="editForm.config.domain" />
            </n-form-item>
            <n-form-item :label="'用户名'" path="config.username">
              <n-input v-model:value="editForm.config.username" />
            </n-form-item>
            <n-form-item :label="'密码'" path="config.password">
              <n-input v-model:value="editForm.config.password" type="password" show-password-on="click" />
            </n-form-item>
           </n-card>
        </template>

      </n-form>
      
      <template #footer>
        <div class="flex justify-end gap-3">
          <n-button @click="showEditModal = false">{{ `取消` }}</n-button>
          <n-button type="primary" @click="saveMountEdit">
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

const addingMount = ref(false);
const mounts = ref([]);
const newMount = reactive({
  mountPoint: '',
  localPath: '',
  type: 'local',
  config: {
      url: '',
      username: '',
      password: '',
      host: '',
      share: '',
      domain: ''
  }
});

const editingMount = ref(null);
const editForm = reactive({
    id: null,
    mountPoint: '',
    localPath: '',
    type: 'local',
    config: {
        url: '',
        username: '',
        password: '',
        host: '',
        share: '',
        domain: ''
    }
});
const showEditModal = ref(false);
const showAddModal = ref(false);

const typeOptions = computed(() => [
  { label: '本地存储', value: 'local' },
  { label: 'WebDAV', value: 'webdav' },
  { label: 'SMB / CIFS', value: 'smb' }
]);

const fetchMounts = async () => {
  try {
    const data = await api.getMyMounts();
    mounts.value = Array.isArray(data) ? data : [];
  } catch (e) {
    toast?.error?.(e?.message || '获取挂载列表失败');
    mounts.value = [];
  }
};

onMounted(() => {
  fetchMounts();
});

const handleAddMount = async () => {
  if (!newMount.mountPoint) return;
  if (newMount.type === 'local' && !newMount.localPath) return;
  if (newMount.type === 'webdav' && !newMount.config.url) return;
  if (newMount.type === 'smb' && (!newMount.config.host || !newMount.config.share)) return;
  
  addingMount.value = true;
  try {
    await api.addMyMount(newMount.mountPoint, newMount.localPath, newMount.type, newMount.config);
    toast?.success?.('添加挂载成功');
    await fetchMounts();
    newMount.mountPoint = '';
    newMount.localPath = '';
    newMount.type = 'local';
    newMount.config = { url: '', host: '', share: '', domain: '', username: '', password: '' };
    showAddModal.value = false;
  } catch (e) {
    toast?.error?.(e?.message || '添加挂载失败');
  } finally {
    addingMount.value = false;
  }
};

const handleDeleteMount = async (id) => {
  const ok = await dialog?.confirm?.('确定要删除此挂载点吗？');
  if (!ok) return;
  try {
    await api.deleteMyMount(id);
    toast?.success?.('删除挂载成功');
    await fetchMounts();
  } catch (e) {
    toast?.error?.(e?.message || '删除挂载失败');
  }
};

const handleEditMount = (mount) => {
    editingMount.value = mount;
    editForm.id = mount.id;
    editForm.mountPoint = mount.mountPoint;
    editForm.localPath = mount.displayLocalPath || mount.localPath;
    editForm.type = mount.type || 'local';
    // Deep copy config to avoid reference issues
    editForm.config = mount.config ? { ...mount.config } : { url: '', host: '', share: '', domain: '', username: '', password: '' };
    showEditModal.value = true;
};

const saveMountEdit = async () => {
    try {
      await api.updateMyMount(editForm.id, editForm.mountPoint, editForm.localPath, editForm.type, editForm.config);
      toast?.success?.('挂载更新成功');
      await fetchMounts();
      showEditModal.value = false;
    } catch (e) {
      toast?.error?.(e?.message || '挂载更新失败');
    }
};
</script>
