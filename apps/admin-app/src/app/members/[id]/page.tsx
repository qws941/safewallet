import ClientPage from "./member-detail";

export function generateStaticParams() {
  return [{ id: "__placeholder" }];
}

export default function Page() {
  return <ClientPage />;
}
