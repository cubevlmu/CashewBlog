import { deleteAdminAssets, getAdminAssetById, getAdminAssets } from '@/api/adminAssets'
import { deleteAdminComments, getAdminComments, updateAdminCommentsState } from '@/api/adminComments'
import { getAdminDashboardSummary } from '@/api/adminDashboard'
import {
  approveAdminPosts,
  getAdminPostById,
  getAdminPosts,
  setAdminPostsPinned,
  updateAdminPostState,
} from '@/api/adminPosts'
import { patchAdminHomeConfig } from '@/api/adminSite'
import {
  createAdminCategory,
  createAdminTag,
  deleteAdminCategories,
  deleteAdminTags,
  getAdminCategories,
  getAdminTags,
  updateAdminCategory,
  updateAdminTag,
} from '@/api/adminTaxonomy'
import {
  createAdminUser,
  deleteAdminUsers,
  getAdminUserById,
  getAdminUsers,
  updateAdminUser,
} from '@/api/adminUsers'
import { createMyBlog, getMyBlogDetail, updateMyBlog } from '@/api/meBlogs'

export {
  approveAdminPosts,
  createAdminCategory,
  createAdminTag,
  createAdminUser,
  createMyBlog,
  deleteAdminAssets,
  deleteAdminCategories,
  deleteAdminComments,
  deleteAdminTags,
  deleteAdminUsers,
  getAdminAssetById,
  getAdminAssets,
  getAdminCategories,
  getAdminComments,
  getAdminDashboardSummary,
  getAdminPostById,
  getAdminPosts,
  getAdminTags,
  getAdminUserById,
  getAdminUsers,
  getMyBlogDetail,
  patchAdminHomeConfig,
  setAdminPostsPinned,
  updateAdminCategory,
  updateAdminCommentsState,
  updateAdminPostState,
  updateAdminTag,
  updateAdminUser,
  updateMyBlog,
}
