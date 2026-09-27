export type AlbumLayout = "grid" | "masonry";

export type AlbumPhoto = {
	id: string;
	src: string;
	thumbnail?: string;
	alt: string;
	title?: string;
	description?: string;
	tags: string[];
	date?: string;
	location?: string;
	width?: number;
	height?: number;
	camera?: string;
	lens?: string;
	settings?: string;
};

export type AlbumGroup = {
	id: string;
	title: string;
	description: string;
	cover: string;
	date: string;
	location: string;
	tags: string[];
	layout: AlbumLayout;
	columns: 2 | 3 | 4;
	hidden: boolean;
	password?: string;
	passwordHint?: string;
	photos: AlbumPhoto[];
};

export type AlbumIndexItem = Omit<AlbumGroup, "photos" | "password"> & {
	photoCount: number;
	protected: boolean;
};
