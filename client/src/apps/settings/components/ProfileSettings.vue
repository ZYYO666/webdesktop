<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
      <div class="max-w-[540px] mx-auto space-y-8">
        
        <!-- Basic Info -->
        <div class="space-y-5">
           <div class="flex items-center justify-between pb-3 border-b border-gray-100">
             <h3 class="text-[15px] font-semibold text-gray-900">基本信息</h3>
           </div>
           
           <n-form label-placement="top" class="space-y-4" :show-feedback="false">
             <div class="grid gap-5">
               <n-form-item :label="`用户名`">
                 <n-input v-model:value="profile.username" :placeholder="`用户名`" />
               </n-form-item>
               
               <n-form-item :label="`角色`">
                 <n-tag :type="profile.role === 'admin' ? 'error' : 'default'" size="small" round :bordered="false" class="px-3">
                   {{ profile.role }}
                 </n-tag>
               </n-form-item>

              <div class="pt-2">
                <div class="flex items-center justify-between">
                  <div class="flex flex-col gap-1">
                    <span class="text-sm font-medium text-gray-700">{{ '全屏覆盖 Dock' }}</span>
                    <span class="text-xs text-gray-500 font-normal">{{ '全屏模式下是否覆盖底部 Dock 栏' }}</span>
                  </div>
                  <n-switch
                    v-model:value="fullscreenCoverDockLocal"
                    :loading="savingFullscreenCoverDock"
                    @update:value="handleUpdateFullscreenCoverDock"
                    size="small"
                  />
                </div>
              </div>

              <div class="pt-2 space-y-3">
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">{{ 'Dock 布局' }}</span>
                  <span class="text-xs text-gray-500 font-normal">{{ '支持调整到上下左右，以及展开占满边缘' }}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <n-form-item :label="`位置`">
                    <n-select
                      v-model:value="dockPositionLocal"
                      :options="dockPositionOptions"
                      :loading="savingDockPosition"
                      @update:value="handleUpdateDockPosition"
                      size="small"
                    />
                  </n-form-item>
                  <n-form-item :label="`模式`">
                    <n-select
                      v-model:value="dockModeLocal"
                      :options="dockModeOptions"
                      :loading="savingDockMode"
                      @update:value="handleUpdateDockMode"
                      size="small"
                    />
                  </n-form-item>
                </div>
              </div>
             </div>
           </n-form>
        </div>

        <!-- Change Password -->
        <div class="space-y-5">
           <div class="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 class="text-[15px] font-semibold text-gray-900">修改密码</h3>
              <span class="text-[12px] text-gray-400 font-normal">{{ '定期修改密码以保护账户安全' }}</span>
           </div>

           <n-form label-placement="top" class="space-y-4" :show-feedback="false">
             <!-- Hidden username field for accessibility/password managers -->
             <input type="text" name="username" :value="profile.username" autocomplete="username" class="hidden" readonly />
             
             <div class="grid gap-4">
               <n-form-item :label="'当前密码'">
                  <n-input 
                    v-model:value="passwordForm.currentPassword" 
                    type="password" 
                    show-password-on="click" 
                    :placeholder="'当前密码'"
                    :input-props="{ autocomplete: 'current-password' }"
                  />
                </n-form-item>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <n-form-item :label="'新密码'">
                    <n-input 
                      v-model:value="passwordForm.newPassword" 
                      type="password" 
                      show-password-on="click" 
                      :placeholder="'新密码'"
                      :input-props="{ autocomplete: 'new-password' }"
                    />
                  </n-form-item>
                  
                  <n-form-item :label="'确认新密码'">
                    <n-input 
                      v-model:value="passwordForm.confirmNewPassword" 
                      type="password" 
                      show-password-on="click" 
                      :placeholder="'确认新密码'"
                      :input-props="{ autocomplete: 'new-password' }"
                    />
                  </n-form-item>
                </div>
             </div>
           </n-form>
           
           <div class="flex justify-end pt-2">
              <n-button type="primary" :loading="savingPassword" @click="handleSavePassword" size="small">
                 {{ `保存更改` }}
              </n-button>
           </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { NButton, NForm, NFormItem, NInput, NTag, NSwitch, NSelect } from 'naive-ui';
import { useOs } from '@/os';

const os = useOs();
const api = os.api;

const toast = os.ui.toast;

const { requestSiteInfoRefresh, updateSiteInfo } = os.stores.system;

const savingPassword = ref(false);
const savingFullscreenCoverDock = ref(false);
const savingDockPosition = ref(false);
const savingDockMode = ref(false);
const loadingFullscreenCoverDock = ref(true);
const fullscreenCoverDockLocal = ref(false);
const dockPositionLocal = ref('bottom');
const dockModeLocal = ref('floating');

const dockPositionOptions = [
  { label: '底部', value: 'bottom' },
  { label: '顶部', value: 'top' },
  { label: '左侧', value: 'left' },
  { label: '右侧', value: 'right' }
];

const dockModeOptions = [
  { label: '悬浮（Mac）', value: 'floating' },
  { label: '占满（Windows 11）', value: 'edge' }
];

const profile = reactive({
  username: '',
  role: ''
});
const originalUsername = ref('');

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: ''
});

onMounted(async () => {
    try {
      const user = os.stores.auth.user;
      if (user) {
        profile.username = user.username;
      profile.role = user.role;
      originalUsername.value = user.username;
    }

    const data = await api.getMe();
    fullscreenCoverDockLocal.value = !!data?.fullscreenCoverDock;
    dockPositionLocal.value = String(data?.dockPosition || 'bottom');
    dockModeLocal.value = String(data?.dockMode || 'floating');
  } catch {
    // ignore
  } finally {
    loadingFullscreenCoverDock.value = false;
  }
});

const handleUpdateFullscreenCoverDock = async (val) => {
  if (loadingFullscreenCoverDock.value) return;
  const prev = fullscreenCoverDockLocal.value;
  fullscreenCoverDockLocal.value = val;
  savingFullscreenCoverDock.value = true;
  updateSiteInfo({ fullscreenCoverDock: fullscreenCoverDockLocal.value });
  try {
    await api.updateProfile({ fullscreenCoverDock: fullscreenCoverDockLocal.value });
    requestSiteInfoRefresh();
  } catch (err) {
    fullscreenCoverDockLocal.value = prev;
    updateSiteInfo({ fullscreenCoverDock: prev });
    toast.error(`保存设置失败`);
  } finally {
    savingFullscreenCoverDock.value = false;
  }
};

const handleUpdateDockPosition = async (val) => {
  if (loadingFullscreenCoverDock.value) return;
  const prev = dockPositionLocal.value;
  dockPositionLocal.value = val;
  savingDockPosition.value = true;
  updateSiteInfo({ dockPosition: dockPositionLocal.value });
  try {
    await api.updateProfile({ dockPosition: dockPositionLocal.value });
    requestSiteInfoRefresh();
  } catch {
    dockPositionLocal.value = prev;
    updateSiteInfo({ dockPosition: prev });
    toast.error(`保存设置失败`);
  } finally {
    savingDockPosition.value = false;
  }
};

const handleUpdateDockMode = async (val) => {
  if (loadingFullscreenCoverDock.value) return;
  const prev = dockModeLocal.value;
  dockModeLocal.value = val;
  savingDockMode.value = true;
  updateSiteInfo({ dockMode: dockModeLocal.value });
  try {
    await api.updateProfile({ dockMode: dockModeLocal.value });
    requestSiteInfoRefresh();
  } catch {
    dockModeLocal.value = prev;
    updateSiteInfo({ dockMode: prev });
    toast.error(`保存设置失败`);
  } finally {
    savingDockMode.value = false;
  }
};

let saveTimeout = null;
watch(() => profile.username, (newVal) => {
  if (newVal === originalUsername.value) return;
  
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveProfile, 1000);
});

const saveProfile = async () => {
  if (!profile.username) return;
  
  try {
    const data = await api.updateProfile({ username: profile.username });
    if (data?.token) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      originalUsername.value = profile.username;
    }
  } catch (err) {
    toast.error('更新资料失败');
  }
};

const handleSavePassword = async () => {
  // Validation
  if (!passwordForm.newPassword) return;

  if (!passwordForm.currentPassword) {
    toast.error('请输入当前密码');
    return;
  }
  if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
    toast.error('两次输入的密码不一致');
    return;
  }

  savingPassword.value = true;
  try {
    const payload = {
      password: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    };
    
    await api.updateProfile(payload);
    toast.success('资料更新成功');
    passwordForm.currentPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmNewPassword = '';
  } catch (err) {
    if (String(err?.message || '').includes('Passwords do not match')) {
      toast.error('两次输入的密码不一致');
    } else {
      toast.error('更新资料失败');
    }
  } finally {
    savingPassword.value = false;
  }
};
</script>
