namespace CashewBlog.Domain.Entities;

public enum PostStatus : short
{
    Draft = 0,
    Published = 1,
    Private = 2,
}

public enum SeriesStatus : short
{
    Ongoing = 0,
    Completed = 1,
}

public enum PageLayout : short
{
    Default = 0,
    Wide = 1,
    FullWidth = 2,
}

public enum MediaKind : short
{
    Image = 0,
    Attachment = 1,
}

public enum MediaOwnerType : short
{
    Post = 0,
    CustomPage = 1,
    SiteSettings = 2,
}
