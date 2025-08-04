import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User,CreateUserDto } from './user.model';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('users')
  async getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }

  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }


  @Get(':username')
  async getUser(@Param('username') username: string): Promise<User> {
    const user = await this.userService.getUser(username);
    if (!user) {
      throw new NotFoundException(`User with ID ${username} not found`);
    }
    return user;
  }

  @Put(':username')
  async updateUser(
    @Param('username') username: string,
    @Body() postData: User,
  ): Promise<User> {
    return this.userService.updateUser(username, postData);
  }
}
