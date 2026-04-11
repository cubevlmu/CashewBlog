export interface NavLink {
  text: string
  link: string
}

export interface OwnerLink extends NavLink {
  icon?: string
}

export interface HomeConfig {
  navbar: {
    headText: string
    links: NavLink[]
  }
  header: {
    title: string
    subtitle: string
    animation: boolean
    image: string
  }
  announcement: string
  intro: {
    blogName: string
    hitokoto: string
  }
  sidebar: {
    customHtml: string
  }
  owner: {
    name: string
    avatar: string
    bio: string
    links: OwnerLink[]
  }
  footer: {
    text: string
    extraHtml: string
  }
  summary: {
    postCount: number
    categoryCount: number
    tagCount: number
  }
}
