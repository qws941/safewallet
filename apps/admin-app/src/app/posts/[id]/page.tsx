import ClientPage from "./post-detail";

export function generateStaticParams() {
  return [{ id: "__placeholder" }];
}

export default function Page() {
  return <ClientPage />;
}
