export class Author implements Author {
  public readonly name: string;
  private profile_image: string;
  private description: string;

  constructor(
    name: string,
    profile_image: string = '',
    description: string = ''
  ) {
    this.name = name;
    this.profile_image = profile_image;
    this.description = description;
  }

  public setProfileImage(profile_image: string) {
    this.profile_image = profile_image;
  }

  public getProfileImage(): string {
    return this.profile_image;
  }

  public setDescription(description: string) {
    this.description = description;
  }

  public getDescription(): string {
    return this.description;
  }
}

// export interface Author {
//   readonly name: string;
//   readonly profile_image: string;
//   readonly description: string;
// }
