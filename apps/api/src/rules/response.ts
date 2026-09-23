export class ResponseClient<T = undefined> {
  status = true;
  message: string;
  result?: T;

  constructor({ message = 'Thao tác thành công', result }: { message?: string; result?: T }) {
    this.message = message;
    if (result !== undefined) this.result = result;
  }
}
